import { apiMessage } from '../common/i18n/api-message';
import { BadRequestException, Injectable } from '@nestjs/common';
import { MembershipService } from '../membership/membership.service';
import { BillingProvider } from '../membership/interfaces/billing-provider.enum';
import { SubscriptionStatus } from '../membership/interfaces/subscription-status.enum';
import { PayPalBillingProvider } from './providers/paypal-billing.provider';
import { MembershipRenewalsService } from './vault/membership-renewals.service';
import { BillingSubscriptionReconciliationService } from './billing-subscription-reconciliation.service';

@Injectable()
export class BillingSubscriptionService {
  constructor(
    private readonly membershipService: MembershipService,
    private readonly paypalProvider: PayPalBillingProvider,
    private readonly renewals: MembershipRenewalsService,
    private readonly reconciliation: BillingSubscriptionReconciliationService,
  ) {}

  async confirm(clinicId: string, providerSubscriptionId?: string) {
    const subscription =
      await this.membershipService.ensureSubscription(clinicId);
    if (subscription.billingMode === 'vault') {
      if (
        providerSubscriptionId &&
        providerSubscriptionId !== subscription.providerSubscriptionId
      )
        throw new BadRequestException(
          apiMessage(
            'api.messages.subscription_does_not_belong_to_this_clinic',
          ),
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
        apiMessage(
          'api.messages.no_matching_paypal_subscription_for_this_clinic',
        ),
      );
    }
    const details = await this.paypalProvider.getSubscription(id);
    if (
      details.clinicId !== clinicId ||
      details.providerPlanId !== subscription.providerPlanId
    ) {
      throw new BadRequestException(
        apiMessage(
          'api.messages.provider_subscription_does_not_match_this_clinic_and_plan',
        ),
      );
    }
    // Reuse the verified-provider synchronization path; no client-supplied status or amounts.
    await this.reconciliation.processPayPalEvent(
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
      throw new BadRequestException(
        apiMessage('api.messages.no_paypal_subscription_to_cancel'),
      );
    }
    const details = await this.paypalProvider.getSubscription(
      subscription.providerSubscriptionId,
    );
    if (details.clinicId !== clinicId)
      throw new BadRequestException(
        apiMessage('api.messages.subscription_ownership_mismatch'),
      );
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
}
