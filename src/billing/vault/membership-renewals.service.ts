import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { MembershipEnrollment } from '../entities/membership-enrollment.entity';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import { ClinicSubscription } from '../../membership/entities/clinic-subscription.entity';
import { ClinicSubscriptionAuditLog } from '../../membership/entities/clinic-subscription-audit-log.entity';
import { MembershipService } from '../../membership/membership.service';
import { MembershipPlanCode } from '../../membership/interfaces/membership-plan-code.enum';
import { SubscriptionStatus } from '../../membership/interfaces/subscription-status.enum';
import { BillingProvider } from '../../membership/interfaces/billing-provider.enum';
import { BillingInterval } from '../interfaces/billing-interval.enum';
import { MembershipPaymentMethod } from '../entities/membership-payment-method.entity';
import { MembershipCharge } from '../entities/membership-charge.entity';
import {
  MembershipPaymentMethodsService,
  methodSummary,
} from './membership-payment-methods.service';
import { PayPalVaultProvider, VaultOrder } from './paypal-vault.provider';
import { withBillingLock } from './billing-lock';
import { membershipQuote } from '../membership-offer';

export function billingPeriodEnd(
  anchor: Date,
  interval: BillingInterval,
  paidCycles: number,
) {
  const date = new Date(anchor);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(
    date.getUTCMonth() +
      paidCycles * (interval === BillingInterval.yearly ? 12 : 1),
  );
  const lastDay = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date;
}
const BILLABLE_STATUSES = [
  SubscriptionStatus.trialing,
  SubscriptionStatus.active,
  SubscriptionStatus.pastDue,
  SubscriptionStatus.incomplete,
];

@Injectable()
export class MembershipRenewalsService {
  constructor(
    private readonly db: DataSource,
    private readonly methods: MembershipPaymentMethodsService,
    private readonly provider: PayPalVaultProvider,
    private readonly membership: MembershipService,
  ) {}

  async start(
    clinicId: string,
    actorId: string,
    input: {
      interval: BillingInterval;
      promotionCode?: string | null;
      paymentMethodId: string;
      requestId: string;
      acceptRecurringBilling: boolean;
      startTrial?: boolean;
    },
  ) {
    if (!this.provider.configured)
      throw new ServiceUnavailableException(
        'PayPal credentials are not configured',
      );
    if (input.acceptRecurringBilling !== true)
      throw new BadRequestException('Recurring billing consent is required');
    await this.membership.ensureSubscription(clinicId);
    await withBillingLock(this.db, clinicId, async (manager) => {
      const repo = manager.getRepository(ClinicSubscription);
      const sub = await repo.findOneByOrFail({ clinicId });
      if (sub.checkoutRequestId === input.requestId) {
        if (
          sub.selectedPaymentMethodId !== input.paymentMethodId ||
          sub.checkoutQuote?.interval !== input.interval ||
          sub.checkoutQuote.promotionCode !==
            (input.promotionCode?.trim().toUpperCase() || null) ||
          (input.startTrial !== undefined &&
            input.startTrial !== Boolean(sub.checkoutQuote.trialDays))
        )
          throw new ConflictException(
            'Request ID already used with different checkout options',
          );
        return;
      }
      if (
        await manager
          .getRepository(MembershipEnrollment)
          .existsBy({ clinicId, requestId: input.requestId })
      )
        throw new ConflictException(
          'Request ID belongs to a previous enrollment',
        );
      if (
        (sub.providerSubscriptionId &&
          BILLABLE_STATUSES.concat(SubscriptionStatus.suspended).includes(
            sub.status,
          )) ||
        sub.planCode === MembershipPlanCode.premium
      )
        throw new ConflictException('A membership already exists');
      const eligible =
        !sub.trialStartedAt && !sub.licenseIssuedAt && !sub.recurringConsentAt;
      const trial = input.startTrial ?? eligible;
      if (trial && !eligible)
        throw new ConflictException('The clinic has already used its trial');
      if (input.promotionCode && (!eligible || !trial))
        throw new BadRequestException(
          'Welcome promotion requires the first trial',
        );
      const quote = membershipQuote(input.interval, input.promotionCode, trial);
      const method = await this.methods.requireMethod(
        manager,
        clinicId,
        input.paymentMethodId,
      );
      await this.methods.verify(method);
      const now = new Date();
      const previousPlanCode = sub.planCode;
      sub.billingMode = 'vault';
      sub.billingProvider = BillingProvider.paypal;
      sub.providerSubscriptionId = `V-${randomUUID()}`;
      sub.providerPlanId = null;
      sub.providerCustomerId = method.providerCustomerId;
      sub.checkoutRequestId = input.requestId;
      sub.checkoutQuote = quote;
      sub.selectedPaymentMethodId = method.id;
      sub.paymentMethodSummary = methodSummary(method);
      sub.recurringConsentAt = now;
      sub.recurringConsentMembershipId = actorId;
      sub.billingAnchorAt = trial
        ? new Date(now.getTime() + 14 * 86400000)
        : now;
      sub.nextChargeAt = sub.billingAnchorAt;
      sub.paidCycles = 0;
      if (trial) {
        sub.trialStartedAt = now;
        sub.trialEndsAt = sub.billingAnchorAt;
      }
      sub.currentPeriodStart = now;
      sub.currentPeriodEnd = sub.billingAnchorAt;
      sub.planCode = trial
        ? MembershipPlanCode.premium
        : MembershipPlanCode.free;
      sub.status = trial
        ? SubscriptionStatus.trialing
        : SubscriptionStatus.incomplete;
      sub.providerStatus = trial ? 'VAULT_TRIALING' : 'VAULT_PAYMENT_PENDING';
      sub.cancelAtPeriodEnd = false;
      sub.reminderDueAt = trial
        ? new Date(sub.billingAnchorAt.getTime() - 2 * 86400000)
        : null;
      sub.reminderSentAt = null;
      sub.reminderFirstAttemptAt = null;
      sub.reminderNextAttemptAt = sub.reminderDueAt;
      sub.reminderAttempts = 0;
      sub.reminderError = null;
      sub.reminderMessage = null;
      sub.reminderProviderId = null;
      await manager.transaction(async (tx) => {
        await tx
          .getRepository(MembershipPaymentMethod)
          .update({ clinicId, isDefault: true }, { isDefault: false });
        await tx
          .getRepository(MembershipPaymentMethod)
          .update({ clinicId, id: method.id }, { isDefault: true });
        await tx.getRepository(ClinicSubscription).save(sub);
        await tx.getRepository(MembershipEnrollment).save({
          clinicId,
          requestId: input.requestId,
          agreementId: sub.providerSubscriptionId!,
        });
        await tx.getRepository(ClinicSubscriptionAuditLog).save({
          clinicId,
          previousPlanCode,
          nextPlanCode: sub.planCode,
          changedByMembershipId: actorId,
          reason:
            'Recurring billing consent accepted; saved payment method enrollment',
        });
      });
    });
    const membership = await this.membership.getCurrent(clinicId);
    return {
      status:
        membership.status === SubscriptionStatus.incomplete
          ? 'payment_pending'
          : membership.status,
      membership,
    };
  }

  async cancel(clinicId: string) {
    await withBillingLock(this.db, clinicId, async (manager) => {
      const sub = await manager
        .getRepository(ClinicSubscription)
        .findOneByOrFail({ clinicId });
      if (sub.billingMode !== 'vault')
        throw new BadRequestException('Not a saved-method membership');
      sub.status = SubscriptionStatus.canceled;
      sub.planCode = MembershipPlanCode.free;
      sub.cancelAtPeriodEnd = false;
      sub.nextChargeAt = null;
      sub.reminderDueAt = null;
      sub.reminderNextAttemptAt = null;
      sub.providerStatus = 'VAULT_CANCELED';
      await manager.getRepository(ClinicSubscription).save(sub);
    });
    return this.membership.getCurrent(clinicId);
  }

  async charges(clinicId: string) {
    return this.db
      .getRepository(MembershipCharge)
      .find({ where: { clinicId }, order: { createdAt: 'DESC' }, take: 100 });
  }

  async processDue() {
    if (!this.provider.configured) return;
    const subs = await this.db
      .getRepository(ClinicSubscription)
      .createQueryBuilder('s')
      .leftJoin(
        MembershipCharge,
        'c',
        'c.agreementId = s.providerSubscriptionId AND c.cycle = s.paidCycles',
      )
      .where(
        's.billingMode = :mode AND s.status IN (:...statuses) AND s.nextChargeAt <= :now',
        { mode: 'vault', statuses: BILLABLE_STATUSES, now: new Date() },
      )
      .andWhere(
        '(c.id IS NULL OR (c.status IN (:...chargeStatuses) AND c.attempts < 5 AND (c.nextAttemptAt IS NULL OR c.nextAttemptAt <= :now)))',
        { chargeStatuses: ['pending', 'failed'] },
      )
      .orderBy('s.nextChargeAt', 'ASC')
      .take(50)
      .getMany();
    for (const sub of subs) {
      try {
        await this.processClinic(sub.clinicId);
      } catch {
        /* This clinic remains due; other clinics must still be processed. */
      }
    }
  }

  async processClinic(
    clinicId: string,
    reconcile?: { chargeId: string; orderId: string },
  ) {
    if (!this.provider.configured)
      throw new ServiceUnavailableException(
        'PayPal credentials are not configured',
      );
    await withBillingLock(this.db, clinicId, async (manager) => {
      const sub = await manager
        .getRepository(ClinicSubscription)
        .findOneBy({ clinicId });
      if (!sub) throw new NotFoundException('Membership not found');
      if (sub.billingMode !== 'vault')
        throw new BadRequestException('Not a saved-method membership');
      const now = new Date();
      if (reconcile) {
        const charge = await manager
          .getRepository(MembershipCharge)
          .findOneBy({ id: reconcile.chargeId, clinicId });
        if (!charge) throw new NotFoundException('Charge not found');
        const order = await this.provider.getOrder(reconcile.orderId);
        this.validateOrder(charge, order);
        if (charge.providerOrderId && charge.providerOrderId !== order.id)
          throw new ConflictException('Charge already has a different order');
        charge.providerOrderId = order.id;
        await manager.getRepository(MembershipCharge).save(charge);
        const reconciled =
          order.status === 'APPROVED' &&
          sub.providerSubscriptionId === charge.agreementId &&
          BILLABLE_STATUSES.includes(sub.status)
            ? await this.provider.captureOrder(order.id, charge.id)
            : order;
        await this.settle(
          manager,
          sub,
          charge,
          reconciled === order ? order : await this.provider.getOrder(order.id),
        );
        return;
      }
      if (
        !BILLABLE_STATUSES.includes(sub.status) ||
        !sub.nextChargeAt ||
        sub.nextChargeAt > now
      )
        return;
      if (
        !sub.checkoutQuote ||
        !sub.billingAnchorAt ||
        !sub.providerSubscriptionId ||
        !sub.selectedPaymentMethodId
      )
        throw new BadRequestException('Incomplete billing agreement');
      const repo = manager.getRepository(MembershipCharge);
      let charge = await repo.findOneBy({
        agreementId: sub.providerSubscriptionId,
        cycle: sub.paidCycles,
      });
      if (!charge)
        charge = await repo.save(
          repo.create({
            clinicId,
            agreementId: sub.providerSubscriptionId,
            cycle: sub.paidCycles,
            amount:
              sub.paidCycles === 0
                ? sub.checkoutQuote.firstCharge
                : sub.checkoutQuote.renewalAmount,
            currency: 'USD',
            dueAt: sub.nextChargeAt,
            periodEnd: billingPeriodEnd(
              sub.billingAnchorAt,
              sub.checkoutQuote.interval,
              sub.paidCycles + 1,
            ),
            nextAttemptAt: now,
          }),
        );
      if (
        charge.status === 'paid' ||
        charge.status === 'refunded' ||
        charge.status === 'action_required' ||
        (charge.nextAttemptAt && charge.nextAttemptAt > now) ||
        charge.attempts >= 5
      )
        return;
      if (
        !charge.providerOrderId &&
        charge.firstAttemptAt &&
        now.getTime() - charge.firstAttemptAt.getTime() > 5 * 3600000
      ) {
        charge.status = 'action_required';
        charge.error = 'RECONCILIATION_REQUIRED';
        await repo.save(charge);
        return;
      }
      charge.firstAttemptAt ??= now;
      charge.attempts += 1;
      await repo.save(charge); // Durable before any financial request.
      try {
        let order: VaultOrder;
        if (charge.providerOrderId)
          order = await this.provider.getOrder(charge.providerOrderId);
        else {
          const method = await this.methods.requireMethod(
            manager,
            clinicId,
            sub.selectedPaymentMethodId,
          );
          await this.methods.verify(method);
          order = await this.provider.createOrder({
            chargeId: charge.id,
            amount: charge.amount,
            type: method.type,
            tokenId: method.providerTokenId,
          });
          this.validateOrder(charge, order);
          charge.providerOrderId = order.id;
          await repo.save(charge); // Persist the order before capturing it.
        }
        if (order.status === 'APPROVED') {
          const method = await this.methods.requireMethod(
            manager,
            clinicId,
            sub.selectedPaymentMethodId,
          );
          await this.methods.verify(method);
          await this.provider.captureOrder(order.id, charge.id, {
            type: method.type,
            tokenId: method.providerTokenId,
          });
          order = await this.provider.getOrder(order.id);
        }
        await this.settle(manager, sub, charge, order);
      } catch {
        charge.status = charge.attempts >= 5 ? 'action_required' : 'failed';
        charge.error = 'PROVIDER_REQUEST_FAILED';
        charge.nextAttemptAt = new Date(
          now.getTime() + Math.min(60, 2 ** charge.attempts) * 60000,
        );
        await repo.save(charge);
        sub.status = SubscriptionStatus.pastDue;
        sub.providerStatus = 'VAULT_PAYMENT_FAILED';
        await manager.getRepository(ClinicSubscription).save(sub);
      }
    });
    return this.membership.getCurrent(clinicId);
  }

  async retry(clinicId: string, chargeId: string) {
    await withBillingLock(this.db, clinicId, async (manager) => {
      const charge = await manager
        .getRepository(MembershipCharge)
        .findOneBy({ id: chargeId, clinicId });
      if (!charge) throw new NotFoundException('Charge not found');
      const sub = await manager
        .getRepository(ClinicSubscription)
        .findOneByOrFail({ clinicId });
      if (
        sub.providerSubscriptionId !== charge.agreementId ||
        !BILLABLE_STATUSES.includes(sub.status)
      )
        throw new ConflictException('The agreement is no longer billable');
      if (['paid', 'refunded'].includes(charge.status))
        throw new ConflictException('This charge cannot be retried');
      if (
        !charge.providerOrderId &&
        charge.firstAttemptAt &&
        Date.now() - charge.firstAttemptAt.getTime() > 5 * 3600000
      )
        throw new ConflictException(
          'Reconcile the provider order before retrying an uncertain payment',
        );
      charge.status = 'pending';
      charge.attempts = 0;
      charge.nextAttemptAt = new Date();
      await manager.getRepository(MembershipCharge).save(charge);
    });
    return this.processClinic(clinicId);
  }

  async handleProviderEvent(
    eventType: string,
    resource: Record<string, unknown>,
  ) {
    const related = resource.supplementary_data as
      { related_ids?: { order_id?: string } } | undefined;
    const orderId =
      eventType === 'CHECKOUT.ORDER.APPROVED'
        ? resource.id
        : related?.related_ids?.order_id;
    if (typeof orderId !== 'string') return;
    const order = await this.provider.getOrder(orderId);
    const id = order.purchase_units?.[0]?.custom_id;
    if (!id || !isUUID(id)) return;
    const charge = await this.db
      .getRepository(MembershipCharge)
      .findOneBy({ id });
    if (!charge) return; // An unrelated merchant order is not a membership.
    return this.processClinic(charge.clinicId, {
      chargeId: charge.id,
      orderId,
    });
  }

  private validateOrder(charge: MembershipCharge, order: VaultOrder) {
    const unit = order.purchase_units?.[0];
    if (
      !order.id ||
      order.purchase_units?.length !== 1 ||
      unit?.custom_id !== charge.id ||
      unit?.invoice_id !== charge.id ||
      unit.amount?.currency_code !== charge.currency ||
      Math.round(Number(unit.amount.value) * 100) !== charge.amount
    )
      throw new BadRequestException('Order does not match the charge');
  }

  private async settle(
    manager: EntityManager,
    sub: ClinicSubscription,
    charge: MembershipCharge,
    order: VaultOrder,
  ) {
    this.validateOrder(charge, order);
    const captures = order.purchase_units![0].payments?.captures ?? [];
    const capture = captures.length === 1 ? captures[0] : undefined;
    if (charge.status === 'refunded') return;
    if (
      capture &&
      ['REFUNDED', 'PARTIALLY_REFUNDED'].includes(capture.status)
    ) {
      charge.status = 'refunded';
      charge.error = 'PAYMENT_REFUNDED';
      await manager.getRepository(MembershipCharge).save(charge);
      if (
        sub.providerSubscriptionId === charge.agreementId &&
        sub.paidCycles === charge.cycle + 1 &&
        BILLABLE_STATUSES.includes(sub.status)
      ) {
        sub.status = SubscriptionStatus.suspended;
        sub.providerStatus = 'VAULT_PAYMENT_REFUNDED';
        await manager.getRepository(ClinicSubscription).save(sub);
      }
      return;
    }
    if (charge.status === 'paid' && capture?.status === 'COMPLETED') return;
    if (
      order.status === 'COMPLETED' &&
      capture?.status === 'COMPLETED' &&
      capture.amount.currency_code === charge.currency &&
      Math.round(Number(capture.amount.value) * 100) === charge.amount
    ) {
      if (charge.status === 'paid') return;
      charge.status = 'paid';
      charge.providerCaptureId = capture.id;
      charge.paidAt = new Date();
      charge.error = null;
      charge.approvalUrl = null;
      charge.nextAttemptAt = null;
      await manager.transaction(async (tx) => {
        await tx.getRepository(MembershipCharge).save(charge);
        // A late capture can settle the ledger after cancellation, but never re-enable renewal.
        if (
          sub.providerSubscriptionId === charge.agreementId &&
          BILLABLE_STATUSES.includes(sub.status) &&
          sub.paidCycles === charge.cycle
        ) {
          sub.status = SubscriptionStatus.active;
          sub.planCode = MembershipPlanCode.premium;
          sub.providerStatus = 'VAULT_ACTIVE';
          sub.paidCycles += 1;
          sub.currentPeriodStart = charge.dueAt;
          sub.currentPeriodEnd = charge.periodEnd;
          sub.nextChargeAt = charge.periodEnd;
          await tx.getRepository(ClinicSubscription).save(sub);
        }
      });
      return;
    }
    charge.approvalUrl =
      order.links?.find((l) => ['payer-action', 'approve'].includes(l.rel))
        ?.href ?? null;
    charge.status = charge.approvalUrl ? 'action_required' : 'pending';
    charge.nextAttemptAt = new Date(Date.now() + 5 * 60000);
    charge.error = charge.approvalUrl
      ? 'PAYER_APPROVAL_REQUIRED'
      : 'PAYMENT_NOT_COMPLETED';
    await manager.getRepository(MembershipCharge).save(charge);
    if (
      sub.providerSubscriptionId === charge.agreementId &&
      BILLABLE_STATUSES.includes(sub.status)
    ) {
      sub.status = SubscriptionStatus.pastDue;
      sub.providerStatus = 'VAULT_PAYMENT_PENDING';
      await manager.getRepository(ClinicSubscription).save(sub);
    }
  }
}
