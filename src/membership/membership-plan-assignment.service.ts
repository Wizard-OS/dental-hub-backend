import { apiMessage } from '../common/i18n/api-message';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ClinicMembership } from '../clinic-memberships/entities/clinic-membership.entity';
import { ClinicSubscription } from './entities/clinic-subscription.entity';
import { ClinicSubscriptionAuditLog } from './entities/clinic-subscription-audit-log.entity';
import { MembershipPlanCode } from './interfaces/membership-plan-code.enum';
import { SubscriptionStatus } from './interfaces/subscription-status.enum';
import { MEMBERSHIP_PLAN_VERSION } from './membership-plan-version';

@Injectable()
export class MembershipPlanAssignmentService {
  constructor(
    @InjectRepository(ClinicSubscription)
    private readonly subscriptionRepository: Repository<ClinicSubscription>,
    @InjectRepository(ClinicSubscriptionAuditLog)
    private readonly auditLogRepository: Repository<ClinicSubscriptionAuditLog>,
    @InjectRepository(ClinicMembership)
    private readonly clinicMembershipRepository: Repository<ClinicMembership>,
  ) {}

  async assignManual(
    clinicId: string,
    changedByMembershipId: string,
    planCode: MembershipPlanCode,
    reason?: string,
  ) {
    const membership = await this.clinicMembershipRepository.findOne({
      where: { id: changedByMembershipId, clinicId, isActive: true },
      select: { id: true },
    });

    if (!membership) {
      throw new BadRequestException(
        apiMessage(
          'api.messages.membership_does_not_belong_to_the_requested_clinic',
        ),
      );
    }

    return this.assignPlan(clinicId, changedByMembershipId, planCode, reason);
  }

  async assignManualFromBackoffice(
    clinicId: string,
    planCode: MembershipPlanCode,
    reason?: string,
  ) {
    return this.assignPlan(clinicId, null, planCode, reason);
  }

  private async assignPlan(
    clinicId: string,
    changedByMembershipId: string | null,
    planCode: MembershipPlanCode,
    reason?: string,
  ) {
    let subscription = await this.subscriptionRepository.findOne({
      where: { clinicId },
    });

    if (!subscription) {
      const now = new Date();
      await this.subscriptionRepository
        .createQueryBuilder()
        .insert()
        .values({
          clinicId,
          planCode: MembershipPlanCode.free,
          planVersion: MEMBERSHIP_PLAN_VERSION,
          status: SubscriptionStatus.active,
          startedAt: now,
          currentPeriodStart: now,
        })
        .orIgnore()
        .execute();
      subscription = await this.subscriptionRepository.findOneByOrFail({
        clinicId,
      });
    }

    const previousPlanCode = subscription.planCode;
    subscription.planCode = planCode;
    subscription.planVersion = MEMBERSHIP_PLAN_VERSION;
    subscription.status = SubscriptionStatus.active;
    subscription.providerCheckoutRequestId = null;
    subscription.providerCheckoutFingerprint = null;
    subscription.assignedByMembershipId = changedByMembershipId;
    subscription.changeReason = reason ?? null;
    subscription.currentPeriodStart =
      subscription.currentPeriodStart ?? new Date();

    const saved = await this.subscriptionRepository.save(subscription);
    await this.auditLogRepository.save(
      this.auditLogRepository.create({
        clinicId,
        previousPlanCode,
        nextPlanCode: planCode,
        changedByMembershipId,
        reason: reason ?? null,
      }),
    );

    return saved.clinicId;
  }
}
