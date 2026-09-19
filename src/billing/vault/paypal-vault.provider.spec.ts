import { PayPalBillingProvider } from '../providers/paypal-billing.provider';
import { PayPalVaultProvider } from './paypal-vault.provider';

describe('PayPal Vault/Orders wire contracts', () => {
  let request: jest.Mock;
  let provider: PayPalVaultProvider;
  const keys = [
    'PAYPAL_CLIENT_ID',
    'PAYPAL_CLIENT_SECRET',
    'PAYPAL_RETURN_URL',
    'PAYPAL_CANCEL_URL',
  ];
  let before: (string | undefined)[];
  beforeEach(() => {
    before = keys.map((k) => process.env[k]);
    keys.forEach(
      (k) =>
        (process.env[k] = k.endsWith('URL')
          ? 'https://example.com/return'
          : 'test'),
    );
    request = jest.fn().mockResolvedValue({ id: 'provider-result' });
    provider = new PayPalVaultProvider({
      paypalRequest: request,
    } as unknown as PayPalBillingProvider);
  });
  afterEach(() =>
    keys.forEach((k, i) => {
      if (before[i] === undefined) delete process.env[k];
      else process.env[k] = before[i];
    }),
  );
  it('creates a card-fields setup without receiving PAN or CVV', async () => {
    await provider.createSetup('clinic', 'card', 'request');
    expect(request).toHaveBeenCalledWith(
      '/v3/vault/setup-tokens',
      expect.objectContaining({
        body: {
          customer: { merchant_customer_id: 'clinic' },
          payment_source: { card: { experience_context: expect.any(Object) } },
        },
      }),
    );
    expect(JSON.stringify(request.mock.calls)).not.toMatch(
      /number|security_code/,
    );
  });
  it('exchanges only approved setup tokens with a stable key', async () => {
    await provider.exchangeSetup('SETUP', 'idempotent');
    expect(request).toHaveBeenCalledWith(
      '/v3/vault/payment-tokens',
      expect.objectContaining({
        headers: { 'PayPal-Request-Id': 'idempotent' },
        body: {
          payment_source: { token: { id: 'SETUP', type: 'SETUP_TOKEN' } },
        },
      }),
    );
  });
  it.each(['card', 'paypal'] as const)(
    'creates a merchant-initiated %s recurring payment for exactly 90 dollars',
    async (type) => {
      await provider.createOrder({
        chargeId: 'charge',
        amount: 9000,
        type,
        tokenId: 'VAULT',
      });
      expect(request).toHaveBeenCalledWith(
        '/v2/checkout/orders',
        expect.objectContaining({
          body: expect.objectContaining({
            purchase_units: [
              expect.objectContaining({
                custom_id: 'charge',
                invoice_id: 'charge',
                amount: { currency_code: 'USD', value: '90.00' },
              }),
            ],
            payment_source: {
              [type]: expect.objectContaining({
                vault_id: 'VAULT',
                stored_credential: expect.objectContaining({
                  payment_initiator: 'MERCHANT',
                }),
              }),
            },
          }),
        }),
      );
    },
  );
  it('captures and deletes only encoded provider IDs', async () => {
    await provider.captureOrder('ORDER', 'capture-key', {
      type: 'card',
      tokenId: 'NEW',
    });
    expect(request).toHaveBeenLastCalledWith(
      '/v2/checkout/orders/ORDER/capture',
      expect.objectContaining({
        body: { payment_source: { card: { vault_id: 'NEW' } } },
      }),
    );
    await provider.deleteToken('token/a');
    expect(request).toHaveBeenLastCalledWith(
      '/v3/vault/payment-tokens/token%2Fa',
      { method: 'DELETE' },
    );
  });
});
