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
}
