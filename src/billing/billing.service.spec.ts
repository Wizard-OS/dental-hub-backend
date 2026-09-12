import { BillingService } from './billing.service';
import { BillingInterval } from './interfaces/billing-interval.enum';
import { MembershipPlanCode } from '../membership/interfaces/membership-plan-code.enum';
import { BillingProvider } from '../membership/interfaces/billing-provider.enum';
import { SubscriptionStatus } from '../membership/interfaces/subscription-status.enum';
import { membershipQuote } from './membership-offer';

describe('Membership checkout lifecycle', () => {
  let service: BillingService;
  let current: any;
  let membership: any;
  let provider: any;
  let details: any;
  const dto = {
    planCode: MembershipPlanCode.premium,
    interval: BillingInterval.yearly,
    startTrial: true,
    promotionCode: 'BIENVENIDA10',
  };
  beforeEach(() => {
    current = {
      planCode: 'free',
      providerSubscriptionId: null,
      licenseIssuedAt: null,
      trialStartedAt: null,
    };
    details = {
      clinicId: 'clinic',
      providerSubscriptionId: 'I-123',
      providerPlanId: 'P-1',
      providerStatus: 'ACTIVE',
      currentPeriodStart: new Date('2026-09-10T00:00:00Z'),
      currentPeriodEnd: new Date('2026-09-24T00:00:00Z'),
    };
    membership = {
      ensureSubscription: jest.fn(async () => current),
      beginProviderSubscription: jest.fn(async (input) =>
        Object.assign(current, input),
      ),
      getCurrent: jest.fn(async () => ({ status: current.status })),
      activateProviderSubscription: jest.fn(async () => ({
        clinicId: 'clinic',
        issuedLicenseKey: null,
      })),
      markProviderSubscription: jest.fn(),
    };
    provider = {
      createSubscription: jest.fn(async () => ({
        provider: BillingProvider.paypal,
        providerSubscriptionId: 'I-123',
        providerPlanId: 'P-1',
        providerStatus: 'APPROVAL_PENDING',
        approvalUrl: 'https://paypal.example/approve',
      })),
      getSubscription: jest.fn(async () => details),
      cancelSubscription: jest.fn(),
    };
    const clinics = {
      manager: { transaction: async (fn) => fn({ query: jest.fn() }) },
    };
    service = new BillingService(
      {} as any,
      clinics as any,
      membership,
      {} as any,
      provider,
      {
        list: jest.fn(async () => ({
          methods: [],
          selectionMode: 'saved_methods',
        })),
      } as any,
      {
        processClinic: jest.fn(),
        cancel: jest.fn(),
        start: jest.fn().mockResolvedValue({ status: 'trialing' }),
      } as any,
    );
  });
  const linked = () =>
    Object.assign(current, {
      billingProvider: 'paypal',
      providerSubscriptionId: 'I-123',
      providerPlanId: 'P-1',
      checkoutQuote: membershipQuote(BillingInterval.yearly, 'BIENVENIDA10'),
    });

  it('persists the quote and returns approval_required without activating Premium', async () => {
    expect(await service.createCheckout('clinic', dto)).toMatchObject({
      status: 'approval_required',
      quote: { firstCharge: 9000 },
    });
    expect(membership.beginProviderSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        checkoutQuote: expect.objectContaining({ totalToday: 0 }),
      }),
    );
    expect(membership.activateProviderSubscription).not.toHaveBeenCalled();
  });
  it('blocks sequential duplicate checkouts before calling the provider twice', async () => {
    await service.createCheckout('clinic', dto);
    await expect(service.createCheckout('clinic', dto)).rejects.toThrow();
    expect(provider.createSubscription).toHaveBeenCalledTimes(1);
  });
  it('rejects reuse of trial and ignores no discount silently', async () => {
    current.trialStartedAt = new Date();
    await expect(service.createCheckout('clinic', dto)).rejects.toThrow();
    current.trialStartedAt = null;
    await expect(
      service.createCheckout('clinic', { ...dto, startTrial: false }),
    ).rejects.toThrow();
    expect(provider.createSubscription).not.toHaveBeenCalled();
  });
  it('does not persist an approved membership when the provider fails', async () => {
    provider.createSubscription.mockRejectedValue(new Error('unavailable'));
    await expect(service.createCheckout('clinic', dto)).rejects.toThrow();
    expect(membership.beginProviderSubscription).not.toHaveBeenCalled();
  });
  it('confirms provider ownership and persists the original 14 day dates', async () => {
    linked();
    await service.confirm('clinic', 'I-123');
    expect(membership.activateProviderSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        trialStartedAt: new Date('2026-09-10T00:00:00Z'),
        trialEndsAt: new Date('2026-09-24T00:00:00Z'),
      }),
    );
  });
  it('restores only the linked subscription and never trusts an arbitrary id', async () => {
    linked();
    await expect(service.confirm('clinic', 'I-OTHER')).rejects.toThrow();
    expect(provider.getSubscription).not.toHaveBeenCalled();
    await service.confirm('clinic');
    expect(provider.getSubscription).toHaveBeenCalledWith('I-123');
  });
  it.each(['clinicId', 'providerPlanId'])(
    'rejects provider mismatch: %s',
    (field) => {
      linked();
      details[field] = 'another';
      return expect(service.confirm('clinic')).rejects.toThrow();
    },
  );
  it('does not activate approval-pending subscriptions', async () => {
    linked();
    details.providerStatus = 'APPROVAL_PENDING';
    await service.confirm('clinic');
    expect(membership.activateProviderSubscription).not.toHaveBeenCalled();
    expect(membership.markProviderSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ status: SubscriptionStatus.incomplete }),
    );
  });
  it('cancels in the provider before changing local state', async () => {
    linked();
    provider.cancelSubscription.mockRejectedValueOnce(new Error('unavailable'));
    await expect(service.cancel('clinic')).rejects.toThrow();
    expect(membership.markProviderSubscription).not.toHaveBeenCalled();
    await service.cancel('clinic');
    expect(membership.markProviderSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ status: SubscriptionStatus.canceled }),
    );
  });
  it('routes saved-method checkout to the recurring service only with actor and consent', async () => {
    const saved = {
      ...dto,
      paymentMethodId: 'saved',
      requestId: 'request',
      acceptRecurringBilling: true as const,
    };
    await expect(service.createCheckout('clinic', saved)).rejects.toThrow();
    await expect(
      service.createCheckout('clinic', saved, 'actor'),
    ).resolves.toMatchObject({ status: 'trialing' });
    expect(provider.createSubscription).not.toHaveBeenCalled();
  });
  it('loads saved payment methods in the requested clinic', async () => {
    await expect(service.paymentMethods('clinic')).resolves.toMatchObject({
      methods: [],
      selectionMode: 'saved_methods',
    });
  });
});
