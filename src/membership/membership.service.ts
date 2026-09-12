import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { Repository } from 'typeorm';

import { ClinicMembership } from '../clinic-memberships/entities/clinic-membership.entity';
import { ClinicMembershipRole } from '../clinic-memberships/interfaces/clinic-membership-role.enum';
import { PatientFile } from '../patient-files/entities/patient-file.entity';
import { Patient } from '../patients/entities/patient.entity';
import { getEnv } from '../config/env';
import { ClinicSubscription } from './entities/clinic-subscription.entity';
import { ClinicSubscriptionAuditLog } from './entities/clinic-subscription-audit-log.entity';
import { BillingProvider } from './interfaces/billing-provider.enum';
import { MembershipPlanCode } from './interfaces/membership-plan-code.enum';
import { SubscriptionStatus } from './interfaces/subscription-status.enum';

import type { MembershipQuote } from '../billing/membership-offer';

type LimitValue = number | null;

export interface MembershipLimits {
  professionalUsers: LimitValue;
  totalUsers: LimitValue;
  activePatients: LimitValue;
  storageBytes: LimitValue;
  messagingCreditsMonthlyIncluded: LimitValue;
}

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

const PLAN_VERSION = '2026-08-mvp';

const PLAN_LIMITS: Record<MembershipPlanCode, MembershipLimits> = {
  [MembershipPlanCode.free]: {
    professionalUsers: 1,
    totalUsers: 2,
    activePatients: null,
    storageBytes: 512 * 1024 * 1024,
    messagingCreditsMonthlyIncluded: 100,
  },
  [MembershipPlanCode.premium]: {
    professionalUsers: 10,
    totalUsers: 20,
    activePatients: null,
    storageBytes: 50 * 1024 * 1024 * 1024,
    messagingCreditsMonthlyIncluded: null,
  },
};

const MVP_ENTITLEMENTS = {
  basicClinicConfiguration: true,
  oneOperationalSite: true,
  basicRoles: true,
  dailyWeeklySchedule: true,
  patientRecords: true,
  clinicalHistory: true,
  basicOdontogram: true,
  treatmentPlans: true,
  simpleEstimates: true,
  basicPayments: true,
  clinicalFiles: true,
  basicReminders: true,
  minimumReports: true,
  googleCalendar: false,
  patientPortal: false,
  onlinePayments: false,
  messagingCredits: false,
  checkout: false,
};

@Injectable()
export class MembershipService {
  constructor(
    @InjectRepository(ClinicSubscription)
    private readonly subscriptionRepository: Repository<ClinicSubscription>,

    @InjectRepository(ClinicSubscriptionAuditLog)
    private readonly auditLogRepository: Repository<ClinicSubscriptionAuditLog>,

    @InjectRepository(ClinicMembership)
    private readonly clinicMembershipRepository: Repository<ClinicMembership>,

    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,

    @InjectRepository(PatientFile)
    private readonly patientFileRepository: Repository<PatientFile>,
  ) {}

  async getCurrent(clinicId: string) {
    const subscription = await this.ensureSubscription(clinicId);
    const effectivePlanCode = this.getEffectivePlanCode(subscription);
    const limits = PLAN_LIMITS[effectivePlanCode];
    const usage = await this.getUsage(clinicId);

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
      warnings: this.buildWarnings(limits, usage),
      entitlements: {
        ...MVP_ENTITLEMENTS,
        checkout: Boolean(
          getEnv('PAYPAL_CLIENT_ID') && getEnv('PAYPAL_CLIENT_SECRET'),
        ),
      },
    };
  }

  async assignManual(
    clinicId: string,
    changedByMembershipId: string,
    planCode: MembershipPlanCode,
    reason?: string,
  ) {
    await this.assertMembershipInClinic(clinicId, changedByMembershipId);

    return this.assignPlan(clinicId, changedByMembershipId, planCode, reason);
  }

  async assignManualFromBackoffice(
    clinicId: string,
    planCode: MembershipPlanCode,
    reason?: string,
  ) {
    return this.assignPlan(clinicId, null, planCode, reason);
  }

  async beginProviderSubscription(input: BeginProviderSubscriptionInput) {
    const subscription = await this.ensureSubscription(input.clinicId);

    if (
      subscription.providerSubscriptionId === input.providerSubscriptionId &&
      subscription.status !== SubscriptionStatus.incomplete
    )
      return this.getCurrent(input.clinicId);
    subscription.checkoutQuote = input.checkoutQuote ?? null;
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
    const subscription = await this.findProviderSubscription(
      input.provider,
      input.providerSubscriptionId,
      input.clinicId,
    );
    const previousPlanCode = subscription.planCode;
    const now = new Date();
    const licenseKey = subscription.licenseKeyHash
      ? null
      : this.generateLicenseKey();

    subscription.planCode = MembershipPlanCode.premium;
    subscription.planVersion = PLAN_VERSION;
    subscription.trialStartedAt =
      input.trialStartedAt ?? subscription.trialStartedAt;
    subscription.trialEndsAt = input.trialEndsAt ?? subscription.trialEndsAt;
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
      subscription.licenseKeyHash = this.hashLicenseKey(licenseKey);
      subscription.licenseKeySuffix = licenseKey.slice(-4);
      subscription.licenseIssuedAt = now;
      subscription.licenseActivatedAt = now;
    }

    await this.subscriptionRepository.save(subscription);

    if (previousPlanCode !== MembershipPlanCode.premium) {
      await this.auditLogRepository.save(
        this.auditLogRepository.create({
          clinicId: subscription.clinicId,
          previousPlanCode,
          nextPlanCode: MembershipPlanCode.premium,
          changedByMembershipId: null,
          reason: `Activated by ${input.provider} subscription ${input.providerSubscriptionId}`,
        }),
      );
    }

    return {
      clinicId: subscription.clinicId,
      membership: await this.getCurrent(subscription.clinicId),
      issuedLicenseKey: licenseKey,
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

  private async assignPlan(
    clinicId: string,
    changedByMembershipId: string | null,
    planCode: MembershipPlanCode,
    reason?: string,
  ) {
    const subscription = await this.ensureSubscription(clinicId);
    const previousPlanCode = subscription.planCode;

    subscription.planCode = planCode;
    subscription.planVersion = PLAN_VERSION;
    subscription.status = SubscriptionStatus.active;
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

    return this.getCurrent(saved.clinicId);
  }

  async assertCanCreateMembership(
    clinicId: string,
    nextRole: ClinicMembershipRole,
  ) {
    const current = await this.getCurrent(clinicId);

    this.assertLimitAvailable(
      current.limits.totalUsers,
      current.usage.totalUsers,
      'User limit reached for current membership',
    );

    if (this.isProfessionalRole(nextRole)) {
      await this.assertCanAddProfessional(clinicId);
    }
  }

  async assertCanAddProfessional(clinicId: string) {
    const current = await this.getCurrent(clinicId);
    this.assertLimitAvailable(
      current.limits.professionalUsers,
      current.usage.professionalUsers,
      'Professional limit reached for current membership',
    );
  }

  async assertCanStoreFile(clinicId: string, incomingBytes: number) {
    const current = await this.getCurrent(clinicId);
    const limit = current.limits.storageBytes;

    if (limit != null && current.usage.storageBytes + incomingBytes > limit) {
      throw new BadRequestException(
        'Storage limit reached for current membership',
      );
    }
  }

  async ensureSubscription(clinicId: string): Promise<ClinicSubscription> {
    const existing = await this.subscriptionRepository.findOne({
      where: { clinicId },
    });

    if (existing) return existing;

    const now = new Date();
    await this.subscriptionRepository
      .createQueryBuilder()
      .insert()
      .values({
        clinicId,
        planCode: MembershipPlanCode.free,
        planVersion: PLAN_VERSION,
        status: SubscriptionStatus.active,
        startedAt: now,
        currentPeriodStart: now,
      })
      .orIgnore()
      .execute();
    return this.subscriptionRepository.findOneByOrFail({ clinicId });
  }

  private async findProviderSubscription(
    provider: BillingProvider,
    providerSubscriptionId: string,
    clinicId?: string,
  ) {
    const existing = await this.subscriptionRepository.findOne({
      where: { billingProvider: provider, providerSubscriptionId },
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

    const subscription = await this.ensureSubscription(clinicId);
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

  private async getUsage(clinicId: string) {
    const [totalUsers, professionalUsers, activePatients, storage] =
      await Promise.all([
        this.clinicMembershipRepository.count({
          where: { clinicId, isActive: true, user: { isActive: true } },
          relations: { user: true },
        }),
        this.clinicMembershipRepository
          .createQueryBuilder('membership')
          .innerJoin('membership.user', 'user')
          .where('membership.clinicId = :clinicId', { clinicId })
          .andWhere('membership.isActive = true')
          .andWhere('user.isActive = true')
          .andWhere('membership.role IN (:...roles)', {
            roles: [
              ClinicMembershipRole.odontologist,
              ClinicMembershipRole.specialist,
            ],
          })
          .getCount(),
        this.patientRepository.count({ where: { clinicId } }),
        this.patientFileRepository
          .createQueryBuilder('file')
          .select('COALESCE(SUM(file.size), 0)', 'total')
          .innerJoin('file.patient', 'patient')
          .where('patient.clinicId = :clinicId', { clinicId })
          .getRawOne<{ total: string }>(),
      ]);

    return {
      professionalUsers,
      totalUsers,
      activePatients,
      storageBytes: Number(storage?.total ?? 0),
      messagingCreditsMonthlyIncluded: 0,
    };
  }

  private buildWarnings(
    limits: MembershipLimits,
    usage: {
      professionalUsers: number;
      totalUsers: number;
      activePatients: number;
      storageBytes: number;
      messagingCreditsMonthlyIncluded: number;
    },
  ) {
    return Object.entries(limits).reduce(
      (acc, [key, limit]) => {
        if (limit == null || key === 'messagingCreditsMonthlyIncluded') {
          return acc;
        }

        const used = usage[key as keyof typeof usage];
        const ratio = used / limit;
        acc[key] = {
          at80Percent: ratio >= 0.8,
          blocked: used >= limit,
        };
        return acc;
      },
      {} as Record<string, { at80Percent: boolean; blocked: boolean }>,
    );
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

  private generateLicenseKey() {
    const segments = Array.from({ length: 3 }, () =>
      randomBytes(3).toString('hex').toUpperCase(),
    );

    return ['DH', 'PREM', ...segments].join('-');
  }

  private hashLicenseKey(licenseKey: string) {
    const secret =
      getEnv('LICENSE_HASH_SECRET') ??
      getEnv('JWT_SECRET') ??
      'development_license_hash_secret';

    return createHash('sha256').update(`${secret}:${licenseKey}`).digest('hex');
  }

  private assertLimitAvailable(
    limit: LimitValue,
    currentUsage: number,
    message: string,
  ) {
    if (limit != null && currentUsage >= limit) {
      throw new BadRequestException(message);
    }
  }

  private async assertMembershipInClinic(
    clinicId: string,
    membershipId: string,
  ) {
    const membership = await this.clinicMembershipRepository.findOne({
      where: { id: membershipId, clinicId, isActive: true },
      select: { id: true },
    });

    if (!membership) {
      throw new BadRequestException(
        'Membership does not belong to the requested clinic',
      );
    }
  }
}
