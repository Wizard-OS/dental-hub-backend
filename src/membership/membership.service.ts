import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { Clinic } from '../clinics/entities/clinic.entity';
import { ClinicMembershipRole } from '../clinic-memberships/interfaces/clinic-membership-role.enum';
import { getEnv } from '../config/env';
import { ClinicSubscription } from './entities/clinic-subscription.entity';
import { ClinicSubscriptionAuditLog } from './entities/clinic-subscription-audit-log.entity';
import { BillingProvider } from './interfaces/billing-provider.enum';
import { MembershipPlanCode } from './interfaces/membership-plan-code.enum';
import { SubscriptionStatus } from './interfaces/subscription-status.enum';
import { NotificationChannel } from '../common/interfaces/notification-channel.enum';
import { OutboundMessagesService } from '../outbound-messages/outbound-messages.service';
import { MembershipEntitlementsService } from './membership-entitlements.service';
import { MembershipCheckoutIntentService } from './membership-checkout-intent.service';
import { MembershipPlanAssignmentService } from './membership-plan-assignment.service';
import { MembershipLicenseService } from './membership-license.service';
import { MEMBERSHIP_PLAN_VERSION } from './membership-plan-version';

import type { MembershipQuote } from '../billing/membership-offer';

export type { MembershipLimits } from './membership-entitlements.service';

interface BeginProviderSubscriptionInput {
  checkoutQuote?: MembershipQuote;
  clinicId: string;
  provider: BillingProvider;
  providerSubscriptionId: string;
  providerPlanId: string;
  providerStatus: string;
}

interface ActivateProviderSubscriptionInput {
  trialStartedAt?: Date | null;
  trialEndsAt?: Date | null;
  clinicId?: string;
  provider: BillingProvider;
  providerSubscriptionId: string;
  providerPlanId?: string | null;
  providerCustomerId?: string | null;
  providerStatus?: string | null;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  webhookEventId?: string | null;
}

interface MarkProviderSubscriptionInput {
  provider: BillingProvider;
  providerSubscriptionId: string;
  status: SubscriptionStatus;
  providerStatus?: string | null;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: Date | null;
  webhookEventId?: string | null;
}

@Injectable()
export class MembershipService {
  constructor(
    @InjectRepository(ClinicSubscription)
    private readonly subscriptionRepository: Repository<ClinicSubscription>,

    private readonly outboundMessagesService: OutboundMessagesService,
    private readonly entitlementsService: MembershipEntitlementsService,
    private readonly checkoutIntentService: MembershipCheckoutIntentService,
    private readonly planAssignmentService: MembershipPlanAssignmentService,
    private readonly licenseService: MembershipLicenseService,
  ) {}

  async getCurrent(clinicId: string) {
    const subscription = await this.ensureSubscription(clinicId);
    const effectivePlanCode = this.getEffectivePlanCode(subscription);
    const limits = this.entitlementsService.getLimits(effectivePlanCode);
    const usage = await this.entitlementsService.getUsage(clinicId);

    return {
      plan: {
        code: subscription.planCode,
        effectiveCode: effectivePlanCode,
        version: subscription.planVersion,
      },
      status: subscription.status,
      billing: {
        provider: subscription.billingProvider,
        providerStatus: subscription.providerStatus,
        providerSubscriptionId: subscription.providerSubscriptionId,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        mode: subscription.billingMode,
        nextChargeAt: subscription.nextChargeAt,
        paidCycles: subscription.paidCycles,
        paymentMethod: subscription.paymentMethodSummary ?? null,
      },
      checkout: subscription.checkoutQuote ?? null,
      trial: {
        eligible:
          !subscription.trialStartedAt &&
          !subscription.licenseIssuedAt &&
          !subscription.recurringConsentAt &&
          subscription.planCode !== MembershipPlanCode.premium,
        startedAt: subscription.trialStartedAt ?? null,
        endsAt: subscription.trialEndsAt ?? null,
        reminderAt: subscription.trialEndsAt
          ? new Date(subscription.trialEndsAt.getTime() - 2 * 86400000)
          : null,
        reminderScheduled: Boolean(
          subscription.reminderDueAt &&
          !subscription.reminderSentAt &&
          subscription.status === SubscriptionStatus.trialing &&
          getEnv('RESEND_API_KEY') &&
          getEnv('MEMBERSHIP_EMAIL_FROM') &&
          getEnv('BILLING_WORKER_ENABLED') !== 'false',
        ),
        reminderSentAt: subscription.reminderSentAt ?? null,
        reminderError: subscription.reminderError ?? null,
      },
      license: {
        issuedAt: subscription.licenseIssuedAt,
        activatedAt: subscription.licenseActivatedAt,
        suffix: subscription.licenseKeySuffix,
      },
      limits,
      usage,
      warnings: this.entitlementsService.buildWarnings(limits, usage),
      entitlements: this.entitlementsService.getEntitlements(
        Boolean(getEnv('PAYPAL_CLIENT_ID') && getEnv('PAYPAL_CLIENT_SECRET')),
      ),
    };
  }

  async assignManual(
    clinicId: string,
    changedByMembershipId: string,
    planCode: MembershipPlanCode,
    reason?: string,
  ) {
    const assignedClinicId = await this.planAssignmentService.assignManual(
      clinicId,
      changedByMembershipId,
      planCode,
      reason,
    );
    return this.getCurrent(assignedClinicId);
  }

  async assignManualFromBackoffice(
    clinicId: string,
    planCode: MembershipPlanCode,
    reason?: string,
  ) {
    const assignedClinicId =
      await this.planAssignmentService.assignManualFromBackoffice(
        clinicId,
        planCode,
        reason,
      );
    return this.getCurrent(assignedClinicId);
  }

  async reserveProviderCheckout(input: {
    clinicId: string;
    fingerprint: string;
    trialRequested: boolean;
    checkoutQuote?: MembershipQuote;
  }) {
    await this.ensureSubscription(input.clinicId);
    return this.checkoutIntentService.reserve(input);
  }

  async beginProviderSubscription(input: BeginProviderSubscriptionInput) {
    const subscription = await this.ensureSubscription(input.clinicId);

    if (
      subscription.providerSubscriptionId === input.providerSubscriptionId &&
      subscription.status !== SubscriptionStatus.incomplete
    )
      return this.getCurrent(input.clinicId);
    subscription.checkoutQuote = input.checkoutQuote ?? null;
    subscription.providerCheckoutRequestId = null;
    subscription.providerCheckoutFingerprint = null;
    subscription.billingMode = 'subscription';
    subscription.selectedPaymentMethodId = null;
    subscription.paymentMethodSummary = null;
    subscription.nextChargeAt = null;
    subscription.reminderDueAt = null;
    subscription.reminderNextAttemptAt = null;
    subscription.billingProvider = input.provider;
    subscription.providerSubscriptionId = input.providerSubscriptionId;
    subscription.providerPlanId = input.providerPlanId;
    subscription.providerStatus = input.providerStatus;
    subscription.status = SubscriptionStatus.incomplete;
    subscription.cancelAtPeriodEnd = false;
    subscription.changeReason = `Checkout started through ${input.provider}`;

    await this.subscriptionRepository.save(subscription);

    return this.getCurrent(input.clinicId);
  }

  async activateProviderSubscription(input: ActivateProviderSubscriptionInput) {
    const activation = await this.subscriptionRepository.manager.transaction(
      async (manager) => {
        const subscription = await this.findProviderSubscription(
          input.provider,
          input.providerSubscriptionId,
          input.clinicId,
          manager,
        );
        const previousPlanCode = subscription.planCode;
        const now = new Date();
        const licenseKey = subscription.licenseKeyHash
          ? null
          : this.licenseService.generateKey();

        subscription.planCode = MembershipPlanCode.premium;
        subscription.planVersion = MEMBERSHIP_PLAN_VERSION;
        subscription.trialStartedAt =
          input.trialStartedAt ?? subscription.trialStartedAt;
        subscription.trialEndsAt =
          input.trialEndsAt ?? subscription.trialEndsAt;
        if (
          input.trialEndsAt &&
          !subscription.reminderDueAt &&
          !subscription.reminderSentAt
        ) {
          subscription.reminderDueAt = new Date(
            input.trialEndsAt.getTime() - 2 * 86400000,
          );
          subscription.reminderNextAttemptAt = subscription.reminderDueAt;
        }
        subscription.status =
          input.trialEndsAt && input.trialEndsAt > now
            ? SubscriptionStatus.trialing
            : SubscriptionStatus.active;
        subscription.billingProvider = input.provider;
        subscription.providerSubscriptionId = input.providerSubscriptionId;
        subscription.providerPlanId =
          input.providerPlanId ?? subscription.providerPlanId;
        subscription.providerCustomerId =
          input.providerCustomerId ?? subscription.providerCustomerId;
        subscription.providerStatus =
          input.providerStatus ?? subscription.providerStatus;
        subscription.currentPeriodStart =
          input.currentPeriodStart ?? subscription.currentPeriodStart ?? now;
        subscription.currentPeriodEnd =
          input.currentPeriodEnd ?? subscription.currentPeriodEnd;
        subscription.cancelAtPeriodEnd = false;
        subscription.lastWebhookEventId =
          input.webhookEventId ?? subscription.lastWebhookEventId;
        subscription.lastWebhookProcessedAt = now;
        subscription.changeReason = `Subscription activated through ${input.provider}`;

        if (licenseKey) {
          subscription.licenseKeyHash = this.licenseService.hashKey(licenseKey);
          subscription.licenseKeySuffix = licenseKey.slice(-4);
          subscription.licenseIssuedAt = now;
          subscription.licenseActivatedAt = now;
        }

        await manager.getRepository(ClinicSubscription).save(subscription);

        if (previousPlanCode !== MembershipPlanCode.premium) {
          await manager.getRepository(ClinicSubscriptionAuditLog).save({
            clinicId: subscription.clinicId,
            previousPlanCode,
            nextPlanCode: MembershipPlanCode.premium,
            changedByMembershipId: null,
            reason: `Activated by ${input.provider} subscription ${input.providerSubscriptionId}`,
          });
        }

        if (licenseKey) {
          const clinic = await manager.getRepository(Clinic).findOne({
            where: { id: subscription.clinicId },
            select: { id: true, name: true, email: true },
          });
          await this.outboundMessagesService.create(
            subscription.clinicId,
            {
              channel: NotificationChannel.EMAIL,
              payloadJson: {
                type: 'premium_license_issued',
                to: clinic?.email ?? null,
                subject: 'Tu membresía Premium fue activada',
                clinicName: clinic?.name ?? null,
                licenseKey,
                provider: input.provider,
                providerSubscriptionId: input.providerSubscriptionId,
                currentPeriodEnd: input.currentPeriodEnd?.toISOString() ?? null,
              },
            },
            manager,
          );
        }

        return {
          clinicId: subscription.clinicId,
          issuedLicenseKey: licenseKey,
        };
      },
    );

    return {
      ...activation,
      membership: await this.getCurrent(activation.clinicId),
    };
  }

  async markProviderSubscription(input: MarkProviderSubscriptionInput) {
    const subscription = await this.findProviderSubscription(
      input.provider,
      input.providerSubscriptionId,
    );

    subscription.status = input.status;
    subscription.providerStatus =
      input.providerStatus ?? subscription.providerStatus;
    subscription.cancelAtPeriodEnd =
      input.cancelAtPeriodEnd ?? subscription.cancelAtPeriodEnd;
    subscription.currentPeriodEnd =
      input.currentPeriodEnd ?? subscription.currentPeriodEnd;
    subscription.lastWebhookEventId =
      input.webhookEventId ?? subscription.lastWebhookEventId;
    subscription.lastWebhookProcessedAt = new Date();

    if (
      [SubscriptionStatus.canceled, SubscriptionStatus.expired].includes(
        input.status,
      )
    ) {
      subscription.planCode = MembershipPlanCode.free;
      subscription.reminderDueAt = null;
      subscription.reminderNextAttemptAt = null;
      subscription.changeReason = `Subscription ended through ${input.provider}`;
    }

    await this.subscriptionRepository.save(subscription);

    return this.getCurrent(subscription.clinicId);
  }

  async assertCanCreateMembership(
    clinicId: string,
    nextRole: ClinicMembershipRole,
  ) {
    const current = await this.getCurrent(clinicId);

    this.entitlementsService.assertMembershipCapacity(
      current.usage,
      current.limits,
    );

    if (this.isProfessionalRole(nextRole)) {
      await this.assertCanAddProfessional(clinicId);
    }
  }

  async assertCanAddProfessional(clinicId: string) {
    const current = await this.getCurrent(clinicId);
    this.entitlementsService.assertProfessionalCapacity(
      current.usage,
      current.limits,
    );
  }

  async assertCanStoreFile(clinicId: string, incomingBytes: number) {
    const current = await this.getCurrent(clinicId);
    this.entitlementsService.assertStorageCapacity(
      current.usage,
      current.limits,
      incomingBytes,
    );
  }

  async ensureSubscription(
    clinicId: string,
    manager?: EntityManager,
  ): Promise<ClinicSubscription> {
    const repository = manager
      ? manager.getRepository(ClinicSubscription)
      : this.subscriptionRepository;
    const existing = await repository.findOne({
      where: { clinicId },
    });

    if (existing) return existing;

    const now = new Date();
    await repository
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
    return repository.findOneByOrFail({ clinicId });
  }

  private async findProviderSubscription(
    provider: BillingProvider,
    providerSubscriptionId: string,
    clinicId?: string,
    manager?: EntityManager,
  ) {
    const repository = manager
      ? manager.getRepository(ClinicSubscription)
      : this.subscriptionRepository;
    const existing = await repository.findOne({
      where: { billingProvider: provider, providerSubscriptionId },
      ...(manager ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });

    if (existing) {
      if (clinicId && existing.clinicId !== clinicId) {
        throw new BadRequestException('Subscription belongs to another clinic');
      }
      return existing;
    }

    if (!clinicId) {
      throw new BadRequestException(
        'Subscription not found for provider event',
      );
    }

    const subscription = await this.ensureSubscription(clinicId, manager);
    subscription.billingProvider = provider;
    subscription.providerSubscriptionId = providerSubscriptionId;

    return subscription;
  }

  isProfessionalRole(role: ClinicMembershipRole): boolean {
    return [
      ClinicMembershipRole.odontologist,
      ClinicMembershipRole.specialist,
    ].includes(role);
  }

  private getEffectivePlanCode(subscription: ClinicSubscription) {
    if (
      subscription.billingMode === 'vault' &&
      subscription.currentPeriodEnd &&
      subscription.currentPeriodEnd <= new Date()
    ) {
      return MembershipPlanCode.free;
    }
    if (
      subscription.status === SubscriptionStatus.trialing &&
      (!subscription.trialEndsAt || subscription.trialEndsAt <= new Date())
    ) {
      return MembershipPlanCode.free;
    }
    if (
      [SubscriptionStatus.active, SubscriptionStatus.trialing].includes(
        subscription.status,
      )
    ) {
      return subscription.planCode;
    }

    return MembershipPlanCode.free;
  }
}
