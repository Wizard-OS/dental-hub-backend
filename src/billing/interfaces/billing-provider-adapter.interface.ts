import { IncomingHttpHeaders } from 'http';

import { MembershipPlanCode } from '../../membership/interfaces/membership-plan-code.enum';
import { BillingProvider } from '../../membership/interfaces/billing-provider.enum';
import { BillingInterval } from './billing-interval.enum';

export interface CreateProviderSubscriptionInput {
  clinicId: string;
  planCode: MembershipPlanCode;
  interval: BillingInterval;
  requestId?: string;
  startTrial?: boolean;
  promotionCode?: string | null;
}

export interface CreatedProviderSubscription {
  provider: BillingProvider;
  providerSubscriptionId: string;
  providerPlanId: string;
  providerStatus: string;
  approvalUrl: string;
}

export interface ProviderSubscriptionDetails {
  trialStartedAt?: Date | null;
  trialEndsAt?: Date | null;
  providerSubscriptionId: string;
  providerPlanId: string | null;
  providerCustomerId: string | null;
  providerStatus: string | null;
  clinicId: string | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
}

export interface ProviderWebhookVerification {
  verified: boolean;
}

export interface BillingProviderAdapter {
  readonly provider: BillingProvider;

  createSubscription(
    input: CreateProviderSubscriptionInput,
  ): Promise<CreatedProviderSubscription>;

  verifyWebhook(
    headers: IncomingHttpHeaders,
    payload: unknown,
  ): Promise<ProviderWebhookVerification>;

  getSubscription(
    providerSubscriptionId: string,
  ): Promise<ProviderSubscriptionDetails>;
}
