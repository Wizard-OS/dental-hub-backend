import { PayPalBillingProvider } from './paypal-billing.provider';
import { BillingInterval } from '../interfaces/billing-interval.enum';
import { MembershipPlanCode } from '../../membership/interfaces/membership-plan-code.enum';

describe('PayPal advertised trial validation', () => {
  let provider: PayPalBillingProvider;
  let request: jest.SpyInstance;
  let plan: any;
  const cycle = (
    sequence: number,
    type: string,
    unit: string,
    count: number,
    total: number,
    price: string,
  ) => ({
    sequence,
    tenure_type: type,
    total_cycles: total,
    frequency: { interval_unit: unit, interval_count: count },
    pricing_scheme: { fixed_price: { value: price, currency_code: 'USD' } },
  });
  const input = {
    clinicId: 'clinic',
    planCode: MembershipPlanCode.premium,
    interval: BillingInterval.yearly,
    startTrial: true,
    promotionCode: 'BIENVENIDA10',
    requestId: 'request-1',
  };
  const envKeys = [
    'PAYPAL_PREMIUM_YEARLY_WELCOME_TRIAL_PLAN_ID',
    'PAYPAL_RETURN_URL',
    'PAYPAL_CANCEL_URL',
  ];
  let env: (string | undefined)[];
  beforeEach(() => {
    env = envKeys.map((key) => process.env[key]);
    envKeys.forEach((key) => (process.env[key] = 'test'));
    plan = {
      status: 'ACTIVE',
      billing_cycles: [
        cycle(1, 'TRIAL', 'DAY', 14, 1, '0.00'),
        cycle(2, 'TRIAL', 'YEAR', 1, 1, '90.00'),
        cycle(3, 'REGULAR', 'YEAR', 1, 0, '100.00'),
      ],
    };
    provider = new PayPalBillingProvider();
    request = jest
      .spyOn(provider as any, 'paypalRequest')
      .mockImplementation((path: unknown) =>
        Promise.resolve(
          String(path).includes('/plans/')
            ? plan
            : {
                id: 'I-123',
                links: [
                  { rel: 'approve', href: 'https://paypal.example/approve' },
                ],
              },
        ),
      );
  });
  afterEach(() =>
    envKeys.forEach((key, index) => {
      if (env[index] === undefined) delete process.env[key];
      else process.env[key] = env[index];
    }),
  );

  it('creates the verified plan with an idempotency header', async () => {
    await expect(provider.createSubscription(input)).resolves.toMatchObject({
      providerSubscriptionId: 'I-123',
    });
    expect(request).toHaveBeenLastCalledWith(
      '/v1/billing/subscriptions',
      expect.objectContaining({
        headers: expect.objectContaining({ 'PayPal-Request-Id': 'request-1' }),
      }),
    );
  });
  it.each([
    'price',
    'currency',
    'trialDuration',
    'setupFee',
    'tax',
    'inactive',
    'discountRecurs',
  ])(
    'rejects a mismatched %s before creating a subscription',
    async (mismatch) => {
      if (mismatch === 'price')
        plan.billing_cycles[2].pricing_scheme.fixed_price.value = '120.00';
      if (mismatch === 'currency')
        plan.billing_cycles[2].pricing_scheme.fixed_price.currency_code = 'EUR';
      if (mismatch === 'trialDuration')
        plan.billing_cycles[0].frequency.interval_count = 7;
      if (mismatch === 'setupFee')
        plan.payment_preferences = { setup_fee: { value: '1.00' } };
      if (mismatch === 'tax') plan.taxes = { percentage: '10' };
      if (mismatch === 'inactive') plan.status = 'INACTIVE';
      if (mismatch === 'discountRecurs')
        plan.billing_cycles[1].total_cycles = 0;
      await expect(provider.createSubscription(input)).rejects.toThrow(
        'does not match',
      );
      expect(request).toHaveBeenCalledTimes(1);
    },
  );
  it('reports unconfigured offers without creating an unrelated legacy plan', async () => {
    delete process.env.PAYPAL_PREMIUM_YEARLY_WELCOME_TRIAL_PLAN_ID;
    await expect(provider.createSubscription(input)).rejects.toThrow(
      'not configured',
    );
    expect(request).not.toHaveBeenCalled();
  });
});
