import { MembershipService } from './membership.service';
import { BillingProvider } from './interfaces/billing-provider.enum';
import { MembershipPlanCode } from './interfaces/membership-plan-code.enum';
import { SubscriptionStatus } from './interfaces/subscription-status.enum';

describe('Provider trial entitlement', () => {
  let service: MembershipService;
  let subscription: any;
  let repository: any;
  beforeEach(() => {
    subscription = {
      clinicId: 'clinic',
      planCode: MembershipPlanCode.free,
      licenseKeyHash: 'existing',
      providerSubscriptionId: 'I-123',
    };
    repository = {
      findOne: jest.fn(async () => subscription),
      save: jest.fn(async (value) => value),
    };
    service = new MembershipService(
      repository,
      { save: jest.fn(), create: jest.fn((v) => v) } as any,
      {} as any,
      {} as any,
      {} as any,
    );
    jest
      .spyOn(service as any, 'getUsage')
      .mockResolvedValue({
        totalUsers: 1,
        professionalUsers: 1,
        activePatients: 1,
        storageBytes: 0,
      });
  });
  it('grants trial Premium only until the confirmed end date', async () => {
    const start = new Date();
    const end = new Date(start.getTime() + 14 * 86400000);
    await service.activateProviderSubscription({
      provider: BillingProvider.paypal,
      providerSubscriptionId: 'I-123',
      clinicId: 'clinic',
      trialStartedAt: start,
      trialEndsAt: end,
    });
    expect(subscription.status).toBe(SubscriptionStatus.trialing);
    expect((await service.getCurrent('clinic')).plan.effectiveCode).toBe(
      'premium',
    );
    subscription.trialEndsAt = new Date(Date.now() - 1000);
    expect((await service.getCurrent('clinic')).plan.effectiveCode).toBe(
      'free',
    );
  });
  it('rejects cross-clinic activation even for an existing provider id', async () => {
    await expect(
      service.activateProviderSubscription({
        provider: BillingProvider.paypal,
        providerSubscriptionId: 'I-123',
        clinicId: 'another-clinic',
      }),
    ).rejects.toThrow('another clinic');
    expect(repository.save).not.toHaveBeenCalled();
  });
  it('does not regress an activated subscription on a repeated begin event', async () => {
    subscription.status = SubscriptionStatus.active;
    await service.beginProviderSubscription({
      clinicId: 'clinic',
      provider: BillingProvider.paypal,
      providerSubscriptionId: 'I-123',
      providerPlanId: 'P-1',
      providerStatus: 'CREATED',
    });
    expect(subscription.status).toBe(SubscriptionStatus.active);
    expect(repository.save).not.toHaveBeenCalled();
  });
});
