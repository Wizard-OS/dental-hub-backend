import { apiMessage } from '../common/i18n/api-message';
import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { getEnv } from '../config/env';
import { MembershipService } from '../membership/membership.service';
import { SubscriptionStatus } from '../membership/interfaces/subscription-status.enum';
import { MembershipPlanCode } from '../membership/interfaces/membership-plan-code.enum';
import { membershipQuote, PROMOTION_CODE } from './membership-offer';
import { MembershipQuoteDto } from './dto/membership-quote.dto';
import { BillingInterval } from './interfaces/billing-interval.enum';
import { CreateBillingCheckoutDto } from './dto/create-billing-checkout.dto';
import { PayPalBillingProvider } from './providers/paypal-billing.provider';
import { MembershipPaymentMethodsService } from './vault/membership-payment-methods.service';
import { MembershipRenewalsService } from './vault/membership-renewals.service';

@Injectable()
export class BillingCheckoutService {
  constructor(
    private readonly membershipService: MembershipService,
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
      throw new BadRequestException(
        apiMessage('api.messages.welcome_promotion_is_no_longer_eligible'),
      );
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
          apiMessage(
            'api.messages.request_id_and_recurring_billing_consent_are_required',
          ),
        );
      if (dto.planCode !== MembershipPlanCode.premium)
        throw new BadRequestException(
          apiMessage('api.messages.only_premium_subscriptions_are_billable'),
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
      throw new BadRequestException(
        apiMessage('api.messages.only_premium_subscriptions_are_billable'),
      );
    }
    if (dto.promotionCode && !dto.startTrial) {
      throw new BadRequestException(
        apiMessage(
          'api.messages.promotions_require_the_membership_trial_offer',
        ),
      );
    }
    const quote = dto.startTrial
      ? membershipQuote(dto.interval, dto.promotionCode)
      : undefined;
    const fingerprint = createHash('sha256')
      .update(
        JSON.stringify([
          dto.planCode,
          dto.interval,
          Boolean(dto.startTrial),
          quote?.promotionCode ??
            dto.promotionCode?.trim().toUpperCase() ??
            null,
        ]),
      )
      .digest('hex');
    const reservation = await this.membershipService.reserveProviderCheckout({
      clinicId,
      fingerprint,
      trialRequested: Boolean(dto.startTrial),
      checkoutQuote: quote,
    });

    // The reservation is committed before the network call. Retries reuse the
    // same provider request ID without holding a database transaction open.
    const created = await this.paypalProvider.createSubscription({
      clinicId,
      requestId: reservation.requestId,
      planCode: dto.planCode,
      interval: dto.interval,
      startTrial: dto.startTrial,
      promotionCode: reservation.quote?.promotionCode,
    });
    await this.membershipService.beginProviderSubscription({
      clinicId,
      provider: created.provider,
      providerSubscriptionId: created.providerSubscriptionId,
      providerPlanId: created.providerPlanId,
      providerStatus: created.providerStatus,
      checkoutQuote: reservation.quote,
    });
    return {
      ...created,
      status: 'approval_required',
      quote: reservation.quote ?? null,
    };
  }
}
