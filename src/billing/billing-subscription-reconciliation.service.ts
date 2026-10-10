import { apiMessage } from '../common/i18n/api-message';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { MembershipService } from '../membership/membership.service';
import { BillingProvider } from '../membership/interfaces/billing-provider.enum';
import { SubscriptionStatus } from '../membership/interfaces/subscription-status.enum';
import { BillingProviderAdapter } from './interfaces/billing-provider-adapter.interface';
import { PayPalBillingProvider } from './providers/paypal-billing.provider';

export interface ProviderWebhookPayload {
  id?: string;
  event_type?: string;
  resource?: Record<string, unknown>;
}

@Injectable()
export class BillingSubscriptionReconciliationService {
  private readonly logger = new Logger(
    BillingSubscriptionReconciliationService.name,
  );

  constructor(private readonly membershipService: MembershipService) {}

  async processPayPalEvent(
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
            apiMessage(
              'api.messages.subscription_does_not_match_current_clinic_checkout',
            ),
          );
        }
        if (local.checkoutQuote && !details.currentPeriodStart) {
          throw new BadRequestException(
            apiMessage(
              'api.messages.provider_has_not_confirmed_the_trial_start_date',
            ),
          );
        }
        const trialStartedAt = local.checkoutQuote
          ? (local.trialStartedAt ?? details.currentPeriodStart)
          : null;
        const trialEndsAt = trialStartedAt
          ? (local.trialEndsAt ??
            new Date(trialStartedAt.getTime() + 14 * 86400000))
          : null;
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

  extractProviderSubscriptionId(event: ProviderWebhookPayload) {
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
}
