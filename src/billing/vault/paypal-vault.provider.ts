import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { getEnv, getRequiredEnv } from '../../config/env';
import { PayPalBillingProvider } from '../providers/paypal-billing.provider';

export interface VaultResource {
  id: string;
  status?: string;
  customer?: { id?: string; merchant_customer_id?: string };
  payment_source?: {
    card?: { brand?: string; last_digits?: string; expiry?: string };
    paypal?: { email_address?: string };
  };
  links?: { rel: string; href: string }[];
}
export interface VaultOrder {
  id: string;
  status: string;
  links?: { rel: string; href: string }[];
  purchase_units?: {
    custom_id?: string;
    invoice_id?: string;
    amount?: { currency_code: string; value: string };
    payments?: {
      captures?: {
        id: string;
        status: string;
        amount: { currency_code: string; value: string };
      }[];
    };
  }[];
}

@Injectable()
export class PayPalVaultProvider {
  constructor(private readonly paypal: PayPalBillingProvider) {}

  get configured() {
    return Boolean(
      getEnv('PAYPAL_CLIENT_ID') && getEnv('PAYPAL_CLIENT_SECRET'),
    );
  }
  get setupConfigured() {
    return (
      this.configured &&
      Boolean(getEnv('PAYPAL_RETURN_URL') && getEnv('PAYPAL_CANCEL_URL'))
    );
  }

  async createSetup(
    clinicId: string,
    type: 'card' | 'paypal',
    requestId: string,
    customerId?: string,
  ) {
    if (!this.setupConfigured)
      throw new ServiceUnavailableException(
        'PayPal credentials and return URLs must be configured',
      );
    const experience = {
      return_url: getRequiredEnv('PAYPAL_RETURN_URL'),
      cancel_url: getRequiredEnv('PAYPAL_CANCEL_URL'),
      brand_name: 'DentalHub',
    };
    return this.paypal.paypalRequest<VaultResource>('/v3/vault/setup-tokens', {
      method: 'POST',
      headers: { 'PayPal-Request-Id': requestId },
      body: {
        customer: customerId
          ? { id: customerId }
          : { merchant_customer_id: clinicId },
        payment_source:
          type === 'card'
            ? { card: { experience_context: experience } }
            : {
                paypal: {
                  description: 'DentalHub Premium — pagos recurrentes',
                  usage_type: 'MERCHANT',
                  usage_pattern: 'RECURRING_PREPAID',
                  permit_multiple_payment_tokens: true,
                  experience_context: experience,
                },
              },
      },
    });
  }
  getSetup(id: string) {
    return this.paypal.paypalRequest<VaultResource>(
      `/v3/vault/setup-tokens/${encodeURIComponent(id)}`,
      { method: 'GET' },
    );
  }
  exchangeSetup(id: string, requestId: string) {
    return this.paypal.paypalRequest<VaultResource>(
      '/v3/vault/payment-tokens',
      {
        method: 'POST',
        headers: { 'PayPal-Request-Id': requestId },
        body: { payment_source: { token: { id, type: 'SETUP_TOKEN' } } },
      },
    );
  }
  getToken(id: string) {
    return this.paypal.paypalRequest<VaultResource>(
      `/v3/vault/payment-tokens/${encodeURIComponent(id)}`,
      { method: 'GET' },
    );
  }
  deleteToken(id: string) {
    return this.paypal.paypalRequest<void>(
      `/v3/vault/payment-tokens/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    );
  }

  createOrder(input: {
    chargeId: string;
    amount: number;
    type: 'card' | 'paypal';
    tokenId: string;
  }) {
    return this.paypal.paypalRequest<VaultOrder>('/v2/checkout/orders', {
      method: 'POST',
      headers: {
        'PayPal-Request-Id': input.chargeId,
        Prefer: 'return=representation',
      },
      body: {
        intent: 'CAPTURE',
        purchase_units: [
          {
            custom_id: input.chargeId,
            invoice_id: input.chargeId,
            description: 'DentalHub Premium',
            amount: {
              currency_code: 'USD',
              value: (input.amount / 100).toFixed(2),
            },
          },
        ],
        payment_source: {
          [input.type]: {
            vault_id: input.tokenId,
            stored_credential:
              input.type === 'card'
                ? {
                    payment_initiator: 'MERCHANT',
                    payment_type: 'RECURRING',
                    usage: 'SUBSEQUENT',
                  }
                : {
                    payment_initiator: 'MERCHANT',
                    usage_pattern: 'RECURRING_PREPAID',
                  },
          },
        },
      },
    });
  }
  getOrder(id: string) {
    return this.paypal.paypalRequest<VaultOrder>(
      `/v2/checkout/orders/${encodeURIComponent(id)}`,
      { method: 'GET' },
    );
  }
  captureOrder(
    id: string,
    chargeId: string,
    method?: { type: 'card' | 'paypal'; tokenId: string },
  ) {
    return this.paypal.paypalRequest<VaultOrder>(
      `/v2/checkout/orders/${encodeURIComponent(id)}/capture`,
      {
        method: 'POST',
        headers: {
          'PayPal-Request-Id': chargeId,
          Prefer: 'return=representation',
        },
        body: method
          ? { payment_source: { [method.type]: { vault_id: method.tokenId } } }
          : {},
      },
    );
  }
}
