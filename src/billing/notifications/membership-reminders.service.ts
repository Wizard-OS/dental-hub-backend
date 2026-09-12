import { Injectable } from '@nestjs/common';
import { isEmail } from 'class-validator';
import { DataSource, EntityManager } from 'typeorm';
import { ClinicSubscription } from '../../membership/entities/clinic-subscription.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { ClinicMembership } from '../../clinic-memberships/entities/clinic-membership.entity';
import { ClinicMembershipRole } from '../../clinic-memberships/interfaces/clinic-membership-role.enum';
import { NotificationPreference } from '../../notification-preferences/entities/notification-preference.entity';
import { SubscriptionStatus } from '../../membership/interfaces/subscription-status.enum';
import { MembershipEmailProvider } from './membership-email.provider';
import { withBillingLock } from '../vault/billing-lock';

@Injectable()
export class MembershipRemindersService {
  constructor(
    private readonly db: DataSource,
    private readonly email: MembershipEmailProvider,
  ) {}
  async processDue() {
    if (!this.email.configured) return;
    const due = await this.db
      .getRepository(ClinicSubscription)
      .createQueryBuilder('s')
      .where(
        's.status = :status AND s.reminderDueAt <= :now AND s.reminderSentAt IS NULL AND s.reminderAttempts < 5',
        { status: SubscriptionStatus.trialing, now: new Date() },
      )
      .andWhere(
        '(s.reminderNextAttemptAt IS NULL OR s.reminderNextAttemptAt <= :now)',
      )
      .orderBy('s.reminderDueAt', 'ASC')
      .take(50)
      .getMany();
    for (const sub of due) {
      try {
        await this.processClinic(sub.clinicId);
      } catch {
        /* Persistence keeps this reminder available for the next run. */
      }
    }
  }
  async processClinic(clinicId: string) {
    if (!this.email.configured) return;
    await withBillingLock(this.db, clinicId, async (manager) => {
      const repo = manager.getRepository(ClinicSubscription);
      const sub = await repo
        .createQueryBuilder('s')
        .addSelect('s.reminderMessage')
        .where('s.clinicId = :clinicId', { clinicId })
        .getOneOrFail();
      const now = new Date();
      if (
        sub.status !== SubscriptionStatus.trialing ||
        !sub.reminderDueAt ||
        sub.reminderDueAt > now ||
        sub.reminderSentAt ||
        (sub.reminderNextAttemptAt && sub.reminderNextAttemptAt > now) ||
        sub.reminderAttempts >= 5
      )
        return;
      if (!sub.trialEndsAt || sub.trialEndsAt <= now) {
        sub.reminderDueAt = null;
        sub.reminderError = 'TRIAL_ALREADY_ENDED';
        await repo.save(sub);
        return;
      }
      const recipient = await this.recipient(manager, clinicId);
      if (!recipient) {
        sub.reminderError = 'NO_ELIGIBLE_RECIPIENT';
        sub.reminderNextAttemptAt = new Date(now.getTime() + 3600000);
        await repo.save(sub);
        return;
      }
      if (
        sub.reminderFirstAttemptAt &&
        now.getTime() - sub.reminderFirstAttemptAt.getTime() >= 23 * 3600000
      ) {
        sub.reminderError = 'DELIVERY_RECONCILIATION_REQUIRED';
        sub.reminderAttempts = 5;
        await repo.save(sub);
        return;
      }
      const price = ((sub.checkoutQuote?.firstCharge ?? 0) / 100).toFixed(2);
      const formattedDate = sub.trialEndsAt.toISOString().slice(0, 10);
      sub.reminderMessage ??= {
        to: recipient,
        subject: 'Tu prueba de DentalHub Premium termina pronto',
        text: `Tu prueba gratuita termina el ${formattedDate} (UTC). El primer cobro será de US$${price}. Puedes cancelar antes de esa fecha desde Ajustes > Membresía para evitar el cobro.`,
      };
      // Do not send a persisted message to an owner who has since opted out or changed.
      if (sub.reminderMessage.to !== recipient) {
        sub.reminderError = 'RECIPIENT_CHANGED';
        sub.reminderAttempts = 5;
        await repo.save(sub);
        return;
      }
      sub.reminderFirstAttemptAt ??= now;
      sub.reminderAttempts += 1;
      await repo.save(sub);
      try {
        sub.reminderProviderId = await this.email.send(
          `membership-trial/${sub.providerSubscriptionId}/${sub.trialEndsAt.toISOString()}`,
          sub.reminderMessage,
        );
        sub.reminderSentAt = new Date();
        sub.reminderError = null;
        sub.reminderNextAttemptAt = null;
      } catch {
        sub.reminderError = 'EMAIL_DELIVERY_FAILED';
        sub.reminderNextAttemptAt = new Date(
          now.getTime() + 2 ** sub.reminderAttempts * 60000,
        );
      }
      await repo.save(sub);
    });
  }
  private async recipient(manager: EntityManager, clinicId: string) {
    const clinic = await manager
      .getRepository(Clinic)
      .findOneBy({ id: clinicId });
    if (!clinic?.isActive) return null;
    // Clinic email is its explicit billing contact. Otherwise respect owner preferences.
    if (clinic.email && isEmail(clinic.email)) return clinic.email;
    const owners = await manager.getRepository(ClinicMembership).find({
      where: {
        clinicId,
        role: ClinicMembershipRole.owner,
        isActive: true,
        user: { isActive: true },
      },
      relations: { user: true },
      order: { createdAt: 'ASC' },
    });
    for (const owner of owners) {
      const preferences = await manager
        .getRepository(NotificationPreference)
        .findOneBy({ userId: owner.userId });
      if (
        preferences &&
        (!preferences.emailNotifications || !preferences.billingAlerts)
      )
        continue;
      if (isEmail(owner.user.email)) return owner.user.email;
    }
    return null;
  }
}
