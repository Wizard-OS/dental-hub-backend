import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IncomingHttpHeaders } from 'http';
import { getEnv } from '../config/env';
import { MembershipPaymentMethodsService } from './vault/membership-payment-methods.service';
import { MembershipRenewalsService } from './vault/membership-renewals.service';
import { createHash } from 'crypto';
import { Repository } from 'typeorm';

import { Clinic } from '../clinics/entities/clinic.entity';
import { NotificationChannel } from '../common/interfaces/notification-channel.enum';
import { MembershipService } from '../membership/membership.service';
import { BillingProvider } from '../membership/interfaces/billing-provider.enum';
import { SubscriptionStatus } from '../membership/interfaces/subscription-status.enum';
import { OutboundMessagesService } from '../outbound-messages/outbound-messages.service';
import { membershipQuote, PROMOTION_CODE } from './membership-offer';
import { MembershipQuoteDto } from './dto/membership-quote.dto';
import { BillingInterval } from './interfaces/billing-interval.enum';
import { MembershipPlanCode } from '../membership/interfaces/membership-plan-code.enum';
import { CreateBillingCheckoutDto } from './dto/create-billing-checkout.dto';
import { BillingWebhookEvent } from './entities/billing-webhook-event.entity';
import { BillingProviderAdapter } from './interfaces/billing-provider-adapter.interface';
import { PayPalBillingProvider } from './providers/paypal-billing.provider';

interface ProviderWebhookPayload {
  id?: string;
  event_type?: string;
  resource?: Record<string, unknown>;
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @InjectRepository(BillingWebhookEvent)
    private readonly webhookEventRepository: Repository<BillingWebhookEvent>,

    @InjectRepository(Clinic)
    private readonly clinicRepository: Repository<Clinic>,

    private readonly membershipService: MembershipService,
    private readonly outboundMessagesService: OutboundMessagesService,
    private readonly paypalProvider: PayPalBillingProvider,
    private readonly savedMethods: MembershipPaymentMethodsService,
    private readonly renewals: MembershipRenewalsService,
  ) {}

  getPlans() {
    return {
      product: {
        code: 'premium',
        name: 'DentalHub Premium',
        features: [
          'unlimited_patients',
          'cloud_clinical_files',
          'appointment_reminders',
          'clinic_reports',
        ],
      },
      plans: [BillingInterval.yearly, BillingInterval.monthly].map(
        (interval) => ({
          ...membershipQuote(interval),
          available: Boolean(
            getEnv('PAYPAL_CLIENT_ID') && getEnv('PAYPAL_CLIENT_SECRET'),
          ),
        }),
      ),
      capabilities: {
        provider: 'paypal',
        hostedPaymentSelection: true,
        savedPaymentMethods: true,
        nativeCardEntry: true,
        cardEntry: 'paypal_card_fields',
        recurringBilling: true,
        trialReminders: true,
        restorePurchases: true,
      },
    };
  }

  async quote(clinicId: string, dto: MembershipQuoteDto) {
    const subscription =
      await this.membershipService.ensureSubscription(clinicId);
    const trialEligible =
      !subscription.trialStartedAt &&
      !subscription.licenseIssuedAt &&
      !subscription.recurringConsentAt &&
      subscription.planCode !== MembershipPlanCode.premium;
    if (dto.promotionCode && !trialEligible)
      throw new BadRequestException('Welcome promotion is no longer eligible');
    const quote = membershipQuote(
      dto.interval,
      dto.promotionCode,
      trialEligible,
    );
    const available = Boolean(
      getEnv('PAYPAL_CLIENT_ID') && getEnv('PAYPAL_CLIENT_SECRET'),
    );
    return {
      ...quote,
      trialEligible,
      available,
      canCheckout:
        (!subscription.providerSubscriptionId ||
          [SubscriptionStatus.canceled, SubscriptionStatus.expired].includes(
            subscription.status,
          )) &&
        subscription.planCode !== MembershipPlanCode.premium &&
        available,
    };
  }

  async promotions(clinicId: string, interval: BillingInterval) {
    const quote = await this.quote(clinicId, { interval });
    return {
      stackable: false,
      promotions:
        interval === BillingInterval.yearly && quote.trialEligible
          ? [
              {
                code: PROMOTION_CODE,
                percentOff: 10,
                appliesTo: 'first_charge',
                discount: 1000,
                currency: 'USD',
                amountUnit: 'minor',
                available: quote.available,
              },
            ]
          : [],
    };
  }

  paymentMethods(clinicId: string) {
    return this.savedMethods.list(clinicId);
  }

  async createCheckout(
    clinicId: string,
    dto: CreateBillingCheckoutDto,
    actorId?: string,
  ) {
    if (dto.paymentMethodId) {
      if (!dto.requestId || !actorId || dto.acceptRecurringBilling !== true)
        throw new BadRequestException(
          'Request ID and recurring billing consent are required',
        );
      if (dto.planCode !== MembershipPlanCode.premium)
        throw new BadRequestException(
          'Only premium subscriptions are billable',
        );
      return this.renewals.start(clinicId, actorId, {
        interval: dto.interval,
        promotionCode: dto.promotionCode,
        paymentMethodId: dto.paymentMethodId,
        requestId: dto.requestId,
        acceptRecurringBilling: dto.acceptRecurringBilling,
        startTrial: dto.startTrial,
      });
    }
    if (dto.planCode !== MembershipPlanCode.premium) {
      throw new BadRequestException('Only premium subscriptions are billable');
    }
    if (dto.promotionCode && !dto.startTrial) {
      throw new BadRequestException(
        'Promotions require the membership trial offer',
      );
    }
    // Serialize checkout attempts for a clinic, including requests from other instances.
    return this.clinicRepository.manager.transaction(async (manager) => {
      await manager.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [`membership-checkout:${clinicId}`],
      );
      const current = await this.membershipService.ensureSubscription(clinicId);
      if (
        (current.providerSubscriptionId &&
          ![SubscriptionStatus.canceled, SubscriptionStatus.expired].includes(
            current.status,
          )) ||
        current.planCode === MembershipPlanCode.premium
      ) {
        throw new ConflictException(
          'A subscription already exists; confirm, restore or cancel it first',
        );
      }
      if (
        dto.startTrial &&
        (current.trialStartedAt ||
          current.licenseIssuedAt ||
          current.recurringConsentAt)
      ) {
        throw new ConflictException('The clinic has already used its trial');
      }
      const quote = dto.startTrial
        ? membershipQuote(dto.interval, dto.promotionCode)
        : undefined;
      const created = await this.paypalProvider.createSubscription({
        clinicId,
        requestId: createHash('sha256')
          .update(
            JSON.stringify([
              clinicId,
              current.id,
              current.updatedAt,
              dto.interval,
              Boolean(dto.startTrial),
              quote?.promotionCode ?? null,
            ]),
          )
          .digest('hex')
          .slice(0, 38),
        planCode: dto.planCode,
        interval: dto.interval,
        startTrial: dto.startTrial,
        promotionCode: quote?.promotionCode,
      });
      await this.membershipService.beginProviderSubscription({
        clinicId,
        provider: created.provider,
        providerSubscriptionId: created.providerSubscriptionId,
        providerPlanId: created.providerPlanId,
        providerStatus: created.providerStatus,
        checkoutQuote: quote,
      });
      return { ...created, status: 'approval_required', quote: quote ?? null };
    });
  }

  async confirm(clinicId: string, providerSubscriptionId?: string) {
    const subscription =
      await this.membershipService.ensureSubscription(clinicId);
    if (subscription.billingMode === 'vault') {
      if (
        providerSubscriptionId &&
        providerSubscriptionId !== subscription.providerSubscriptionId
      )
        throw new BadRequestException(
          'Subscription does not belong to this clinic',
        );
      return this.renewals.processClinic(clinicId);
    }
    const id = providerSubscriptionId ?? subscription.providerSubscriptionId;
    if (
      !id ||
      id !== subscription.providerSubscriptionId ||
      subscription.billingProvider !== BillingProvider.paypal
    ) {
      throw new BadRequestException(
        'No matching PayPal subscription for this clinic',
      );
    }
    const details = await this.paypalProvider.getSubscription(id);
    if (
      details.clinicId !== clinicId ||
      details.providerPlanId !== subscription.providerPlanId
    ) {
      throw new BadRequestException(
        'Provider subscription does not match this clinic and plan',
      );
    }
    // Reuse the verified-provider synchronization path; no client-supplied status or amounts.
    await this.processPayPalEvent(
      this.paypalProvider,
      {
        event_type: 'BILLING.SUBSCRIPTION.UPDATED',
        resource: { id },
      },
      undefined,
      details,
    );
    return this.membershipService.getCurrent(clinicId);
  }

  async cancel(clinicId: string) {
    const subscription =
      await this.membershipService.ensureSubscription(clinicId);
    if (subscription.billingMode === 'vault')
      return this.renewals.cancel(clinicId);
    if (
      !subscription.providerSubscriptionId ||
      subscription.billingProvider !== BillingProvider.paypal
    ) {
      throw new BadRequestException('No PayPal subscription to cancel');
    }
    const details = await this.paypalProvider.getSubscription(
      subscription.providerSubscriptionId,
    );
    if (details.clinicId !== clinicId)
      throw new BadRequestException('Subscription ownership mismatch');
    if (details.providerStatus !== 'CANCELLED') {
      await this.paypalProvider.cancelSubscription(
        subscription.providerSubscriptionId,
      );
    }
    return this.membershipService.markProviderSubscription({
      provider: BillingProvider.paypal,
      providerSubscriptionId: subscription.providerSubscriptionId,
      status: SubscriptionStatus.canceled,
      providerStatus: 'CANCELLED',
      cancelAtPeriodEnd: false,
    });
  }

  async handlePayPalWebhook(headers: IncomingHttpHeaders, payload: unknown) {
    const provider = this.getProvider(BillingProvider.paypal);
    const verification = await provider.verifyWebhook(headers, payload);

    if (!verification.verified) {
      throw new UnauthorizedException('Invalid PayPal webhook signature');
    }

    const event = this.asWebhookPayload(payload);
    const eventId =
      event.id ?? this.getHeader(headers, 'paypal-transmission-id');
    const eventType = event.event_type;

    if (!eventId || !eventType) {
      throw new BadRequestException('Invalid PayPal webhook payload');
    }

    const providerSubscriptionId =
      this.extractProviderSubscriptionId(event) ?? null;
    const existing = await this.webhookEventRepository.findOne({
      where: { provider: BillingProvider.paypal, eventId },
    });

    if (existing?.processedAt) {
      return {
        received: true,
        duplicate: true,
        eventId,
        eventType,
      };
    }

    const savedEvent =
      existing ??
      (await this.webhookEventRepository.save(
        this.webhookEventRepository.create({
          provider: BillingProvider.paypal,
          eventId,
          eventType,
          providerSubscriptionId,
          payload: this.toRecord(payload),
          processedAt: null,
        }),
      ));

    if (
      eventType.startsWith('PAYMENT.CAPTURE.') ||
      eventType === 'CHECKOUT.ORDER.APPROVED'
    ) {
      await this.renewals.handleProviderEvent(eventType, event.resource ?? {});
    } else {
      await this.processPayPalEvent(provider, event, eventId);
    }

    savedEvent.processedAt = new Date();
    await this.webhookEventRepository.save(savedEvent);

    return {
      received: true,
      duplicate: false,
      eventId,
      eventType,
    };
  }

  private async processPayPalEvent(
    provider: BillingProviderAdapter,
    event: ProviderWebhookPayload,
    eventId?: string,
    verifiedDetails?: Awaited<
      ReturnType<PayPalBillingProvider['getSubscription']>
    >,
  ) {
    const providerSubscriptionId = this.extractProviderSubscriptionId(event);

    if (!providerSubscriptionId) {
      this.logger.debug(`Ignoring PayPal event without subscription id`);
      return;
    }

    if (
      [
        'BILLING.SUBSCRIPTION.ACTIVATED',
        'BILLING.SUBSCRIPTION.UPDATED',
        'PAYMENT.SALE.COMPLETED',
      ].includes(event.event_type ?? '')
    ) {
      const details =
        verifiedDetails ??
        (await provider.getSubscription(providerSubscriptionId));

      if (this.isActivePayPalStatus(details.providerStatus)) {
        const local = details.clinicId
          ? await this.membershipService.ensureSubscription(details.clinicId)
          : null;
        if (
          !local ||
          local.providerSubscriptionId !== providerSubscriptionId ||
          local.providerPlanId !== details.providerPlanId
        ) {
          throw new BadRequestException(
            'Subscription does not match current clinic checkout',
          );
        }
        if (local.checkoutQuote && !details.currentPeriodStart) {
          throw new BadRequestException(
            'Provider has not confirmed the trial start date',
          );
        }
        const trialStartedAt = local.checkoutQuote
          ? (local.trialStartedAt ?? details.currentPeriodStart)
          : null;
        const trialEndsAt = trialStartedAt
          ? (local.trialEndsAt ??
            new Date(trialStartedAt.getTime() + 14 * 86400000))
          : null;
        const activation =
          await this.membershipService.activateProviderSubscription({
            clinicId: details.clinicId ?? undefined,
            provider: BillingProvider.paypal,
            providerSubscriptionId: details.providerSubscriptionId,
            providerPlanId: details.providerPlanId,
            providerCustomerId: details.providerCustomerId,
            providerStatus: details.providerStatus,
            currentPeriodStart: details.currentPeriodStart,
            currentPeriodEnd: details.currentPeriodEnd,
            webhookEventId: eventId,
            trialStartedAt,
            trialEndsAt,
          });

        if (activation.issuedLicenseKey) {
          await this.queueLicenseDelivery({
            clinicId: activation.clinicId,
            licenseKey: activation.issuedLicenseKey,
            providerSubscriptionId: details.providerSubscriptionId,
            currentPeriodEnd: details.currentPeriodEnd,
          });
        }
        return;
      }

      await this.membershipService.markProviderSubscription({
        provider: BillingProvider.paypal,
        providerSubscriptionId,
        status: this.mapPayPalStatus(details.providerStatus),
        providerStatus: details.providerStatus,
        currentPeriodEnd: details.currentPeriodEnd,
        webhookEventId: eventId,
      });
      return;
    }

    if (event.event_type === 'BILLING.SUBSCRIPTION.CREATED') return;

    if (event.event_type === 'BILLING.SUBSCRIPTION.PAYMENT.FAILED') {
      await this.membershipService.markProviderSubscription({
        provider: BillingProvider.paypal,
        providerSubscriptionId,
        status: SubscriptionStatus.pastDue,
        providerStatus: 'PAYMENT_FAILED',
        webhookEventId: eventId,
      });
      return;
    }

    if (event.event_type === 'BILLING.SUBSCRIPTION.SUSPENDED') {
      await this.membershipService.markProviderSubscription({
        provider: BillingProvider.paypal,
        providerSubscriptionId,
        status: SubscriptionStatus.suspended,
        providerStatus: 'SUSPENDED',
        webhookEventId: eventId,
      });
      return;
    }

    if (event.event_type === 'BILLING.SUBSCRIPTION.CANCELLED') {
      await this.membershipService.markProviderSubscription({
        provider: BillingProvider.paypal,
        providerSubscriptionId,
        status: SubscriptionStatus.canceled,
        providerStatus: 'CANCELLED',
        cancelAtPeriodEnd: true,
        webhookEventId: eventId,
      });
      return;
    }

    if (event.event_type === 'BILLING.SUBSCRIPTION.EXPIRED') {
      await this.membershipService.markProviderSubscription({
        provider: BillingProvider.paypal,
        providerSubscriptionId,
        status: SubscriptionStatus.expired,
        providerStatus: 'EXPIRED',
        webhookEventId: eventId,
      });
    }
  }

  private getProvider(provider: BillingProvider): BillingProviderAdapter {
    if (provider === BillingProvider.paypal) {
      return this.paypalProvider;
    }

    throw new BadRequestException(`Unsupported billing provider ${provider}`);
  }

  private asWebhookPayload(payload: unknown): ProviderWebhookPayload {
    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('Webhook payload must be an object');
    }

    return payload;
  }

  private extractProviderSubscriptionId(event: ProviderWebhookPayload) {
    const resource = event.resource;

    if (!resource) return null;

    if (event.event_type?.startsWith('BILLING.SUBSCRIPTION.')) {
      return this.stringValue(resource.id);
    }

    return (
      this.stringValue(resource.billing_agreement_id) ??
      this.stringValue(resource.subscription_id) ??
      this.stringValue(resource.billing_subscription_id)
    );
  }

  private mapPayPalStatus(status: string | null) {
    switch (status) {
      case 'ACTIVE':
        return SubscriptionStatus.active;
      case 'APPROVAL_PENDING':
      case 'APPROVED':
        return SubscriptionStatus.incomplete;
      case 'SUSPENDED':
        return SubscriptionStatus.suspended;
      case 'CANCELLED':
        return SubscriptionStatus.canceled;
      case 'EXPIRED':
        return SubscriptionStatus.expired;
      default:
        return SubscriptionStatus.incomplete;
    }
  }

  private isActivePayPalStatus(status: string | null) {
    return status === 'ACTIVE';
  }

  private stringValue(value: unknown) {
    return typeof value === 'string' && value.trim() ? value : null;
  }

  private getHeader(headers: IncomingHttpHeaders, name: string) {
    const value = headers[name];
    return typeof value === 'string' ? value : null;
  }

  private toRecord(payload: unknown): Record<string, unknown> {
    if (payload && typeof payload === 'object') {
      return payload as Record<string, unknown>;
    }

    return { value: payload };
  }

  private async queueLicenseDelivery(input: {
    clinicId: string;
    licenseKey: string;
    providerSubscriptionId: string;
    currentPeriodEnd: Date | null;
  }) {
    const clinic = await this.clinicRepository.findOne({
      where: { id: input.clinicId },
      select: { id: true, name: true, email: true },
    });

    await this.outboundMessagesService.create(input.clinicId, {
      channel: NotificationChannel.EMAIL,
      payloadJson: {
        type: 'premium_license_issued',
        to: clinic?.email ?? null,
        subject: 'Tu membresía Premium fue activada',
        clinicName: clinic?.name ?? null,
        licenseKey: input.licenseKey,
        provider: BillingProvider.paypal,
        providerSubscriptionId: input.providerSubscriptionId,
        currentPeriodEnd: input.currentPeriodEnd?.toISOString() ?? null,
      },
    });
  }
}
