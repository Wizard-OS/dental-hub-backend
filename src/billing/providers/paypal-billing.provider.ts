import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { IncomingHttpHeaders } from 'http';

import { getEnv, getRequiredEnv } from '../../config/env';
import { BillingProvider } from '../../membership/interfaces/billing-provider.enum';
import { MembershipPlanCode } from '../../membership/interfaces/membership-plan-code.enum';
import { BillingInterval } from '../interfaces/billing-interval.enum';
import {
  BillingProviderAdapter,
  CreateProviderSubscriptionInput,
  CreatedProviderSubscription,
  ProviderSubscriptionDetails,
  ProviderWebhookVerification,
} from '../interfaces/billing-provider-adapter.interface';

import { membershipQuote, offerPlanId } from '../membership-offer';

interface PlanCycle {
  sequence: number;
  tenure_type: string;
  total_cycles: number;
  frequency: { interval_unit: string; interval_count: number };
  pricing_scheme?: { fixed_price?: { value: string; currency_code: string } };
}

interface PayPalLink {
  href?: string;
  rel?: string;
  method?: string;
}

interface PayPalSubscriptionResponse {
  id?: string;
  plan_id?: string;
  status?: string;
  custom_id?: string;
  start_time?: string;
  subscriber?: {
    payer_id?: string;
  };
  billing_info?: {
    next_billing_time?: string;
  };
  links?: PayPalLink[];
}

interface PayPalVerifyWebhookResponse {
  verification_status?: string;
}

@Injectable()
export class PayPalBillingProvider implements BillingProviderAdapter {
  readonly provider = BillingProvider.paypal;

  private readonly logger = new Logger(PayPalBillingProvider.name);

  async createSubscription(
    input: CreateProviderSubscriptionInput,
  ): Promise<CreatedProviderSubscription> {
    if (input.planCode !== MembershipPlanCode.premium) {
      throw new BadRequestException('Only premium subscriptions are billable');
    }

    const providerPlanId = input.startTrial
      ? offerPlanId(input.interval, input.promotionCode)
      : this.getPlanId(input.interval);
    if (!providerPlanId)
      throw new ServiceUnavailableException(
        'Membership offer is not configured',
      );
    if (input.startTrial) await this.validateOfferPlan(providerPlanId, input);

    const subscription = await this.paypalRequest<PayPalSubscriptionResponse>(
      '/v1/billing/subscriptions',
      {
        method: 'POST',
        headers: {
          Prefer: 'return=representation',
          ...(input.requestId ? { 'PayPal-Request-Id': input.requestId } : {}),
        },
        body: {
          plan_id: providerPlanId,
          custom_id: input.clinicId,
          application_context: {
            brand_name: getEnv('PAYPAL_BRAND_NAME') ?? 'Dental Hub',
            user_action: 'SUBSCRIBE_NOW',
            return_url: getRequiredEnv('PAYPAL_RETURN_URL'),
            cancel_url: getRequiredEnv('PAYPAL_CANCEL_URL'),
          },
        },
      },
    );

    if (!subscription.id) {
      throw new BadRequestException('PayPal did not return a subscription id');
    }

    const approvalUrl = subscription.links?.find(
      (link) => link.rel === 'approve',
    )?.href;

    if (!approvalUrl) {
      throw new BadRequestException('PayPal did not return an approval URL');
    }

    return {
      provider: this.provider,
      providerSubscriptionId: subscription.id,
      providerPlanId,
      providerStatus: subscription.status ?? 'CREATED',
      approvalUrl,
    };
  }

  private async validateOfferPlan(
    planId: string,
    input: CreateProviderSubscriptionInput,
  ) {
    const plan = await this.paypalRequest<{
      status: string;
      billing_cycles: PlanCycle[];
      payment_preferences?: { setup_fee?: { value: string } };
      taxes?: { percentage: string };
      quantity_supported?: boolean;
    }>(`/v1/billing/plans/${encodeURIComponent(planId)}`, { method: 'GET' });
    const quote = membershipQuote(input.interval, input.promotionCode);
    const cycles = [...(plan.billing_cycles ?? [])].sort(
      (a, b) => a.sequence - b.sequence,
    );
    const amount = (cycle: PlanCycle) =>
      Math.round(Number(cycle.pricing_scheme?.fixed_price?.value ?? 0) * 100);
    const expected = [
      { unit: 'DAY', count: 14, type: 'TRIAL', total: 1, amount: 0 },
      ...(quote.promotionCode
        ? [{ unit: 'YEAR', count: 1, type: 'TRIAL', total: 1, amount: 9000 }]
        : []),
      {
        unit: input.interval === BillingInterval.yearly ? 'YEAR' : 'MONTH',
        count: 1,
        type: 'REGULAR',
        total: 0,
        amount: quote.renewalAmount,
      },
    ];
    if (
      plan.status !== 'ACTIVE' ||
      plan.quantity_supported ||
      Number(plan.payment_preferences?.setup_fee?.value ?? 0) !== 0 ||
      Number(plan.taxes?.percentage ?? 0) !== 0 ||
      cycles.length !== expected.length ||
      expected.some((e, i) => {
        const c = cycles[i];
        return (
          !c ||
          c.sequence !== i + 1 ||
          c.tenure_type !== e.type ||
          c.total_cycles !== e.total ||
          c.frequency?.interval_unit !== e.unit ||
          c.frequency?.interval_count !== e.count ||
          amount(c) !== e.amount ||
          (c.pricing_scheme?.fixed_price &&
            c.pricing_scheme.fixed_price.currency_code !== 'USD')
        );
      })
    ) {
      throw new ServiceUnavailableException(
        'PayPal plan does not match the advertised membership offer',
      );
    }
  }

  async cancelSubscription(id: string) {
    await this.paypalRequest(
      `/v1/billing/subscriptions/${encodeURIComponent(id)}/cancel`,
      {
        method: 'POST',
        body: { reason: 'Canceled by clinic administrator' },
      },
    );
  }

  async verifyWebhook(
    headers: IncomingHttpHeaders,
    payload: unknown,
  ): Promise<ProviderWebhookVerification> {
    const webhookId = getRequiredEnv('PAYPAL_WEBHOOK_ID');
    const verification = await this.paypalRequest<PayPalVerifyWebhookResponse>(
      '/v1/notifications/verify-webhook-signature',
      {
        method: 'POST',
        body: {
          auth_algo: this.requireHeader(headers, 'paypal-auth-algo'),
          cert_url: this.requireHeader(headers, 'paypal-cert-url'),
          transmission_id: this.requireHeader(
            headers,
            'paypal-transmission-id',
          ),
          transmission_sig: this.requireHeader(
            headers,
            'paypal-transmission-sig',
          ),
          transmission_time: this.requireHeader(
            headers,
            'paypal-transmission-time',
          ),
          webhook_id: webhookId,
          webhook_event: payload,
        },
      },
    );

    return { verified: verification.verification_status === 'SUCCESS' };
  }

  async getSubscription(
    providerSubscriptionId: string,
  ): Promise<ProviderSubscriptionDetails> {
    const subscription = await this.paypalRequest<PayPalSubscriptionResponse>(
      `/v1/billing/subscriptions/${encodeURIComponent(providerSubscriptionId)}`,
      { method: 'GET' },
    );

    return {
      providerSubscriptionId,
      providerPlanId: subscription.plan_id ?? null,
      providerCustomerId: subscription.subscriber?.payer_id ?? null,
      providerStatus: subscription.status ?? null,
      clinicId: subscription.custom_id ?? null,
      currentPeriodStart: this.parseDate(subscription.start_time),
      currentPeriodEnd: this.parseDate(
        subscription.billing_info?.next_billing_time,
      ),
    };
  }

  private getPlanId(interval: BillingInterval) {
    if (interval === BillingInterval.monthly) {
      return getRequiredEnv('PAYPAL_PREMIUM_MONTHLY_PLAN_ID');
    }

    return getRequiredEnv('PAYPAL_PREMIUM_YEARLY_PLAN_ID');
  }

  async paypalRequest<T>(
    path: string,
    options: {
      method: 'GET' | 'POST' | 'DELETE';
      headers?: Record<string, string>;
      body?: Record<string, unknown>;
    },
  ): Promise<T> {
    if (!getEnv('PAYPAL_CLIENT_ID') || !getEnv('PAYPAL_CLIENT_SECRET')) {
      throw new ServiceUnavailableException(
        'PayPal credentials are not configured',
      );
    }
    const accessToken = await this.getAccessToken();
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: options.method,
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      this.logger.error(
        `PayPal API request failed with status ${response.status}`,
      );
      throw new PayPalRequestError(response.status);
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  private async getAccessToken() {
    const clientId = getRequiredEnv('PAYPAL_CLIENT_ID');
    const clientSecret = getRequiredEnv('PAYPAL_CLIENT_SECRET');
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
      'base64',
    );
    const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ grant_type: 'client_credentials' }),
    });

    if (!response.ok) {
      this.logger.error(`PayPal OAuth failed with status ${response.status}`);
      throw new BadRequestException('PayPal authentication failed');
    }

    const body = (await response.json()) as { access_token?: string };

    if (!body.access_token) {
      throw new BadRequestException('PayPal did not return an access token');
    }

    return body.access_token;
  }

  private get baseUrl() {
    return getEnv('PAYPAL_ENV') === 'live'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';
  }

  private requireHeader(headers: IncomingHttpHeaders, name: string) {
    const value = headers[name];

    if (!value || Array.isArray(value)) {
      throw new BadRequestException(`Missing PayPal webhook header ${name}`);
    }

    return value;
  }

  private parseDate(value?: string) {
    if (!value) return null;

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
}

export class PayPalRequestError extends BadRequestException {
  constructor(readonly providerStatus: number) {
    super('PayPal request failed');
  }
}
