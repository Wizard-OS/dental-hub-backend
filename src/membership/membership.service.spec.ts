import { MembershipService } from './membership.service';
import { MembershipEntitlementsService } from './membership-entitlements.service';
import { MembershipCheckoutIntentService } from './membership-checkout-intent.service';
import { MembershipLicenseService } from './membership-license.service';
import { Clinic } from '../clinics/entities/clinic.entity';
import { ClinicSubscription } from './entities/clinic-subscription.entity';
import { ClinicSubscriptionAuditLog } from './entities/clinic-subscription-audit-log.entity';
import type { OutboundMessagesService } from '../outbound-messages/outbound-messages.service';
import { BillingProvider } from './interfaces/billing-provider.enum';
import { MembershipPlanCode } from './interfaces/membership-plan-code.enum';
import { SubscriptionStatus } from './interfaces/subscription-status.enum';

describe('Provider trial entitlement', () => {
  let service: MembershipService;
  let subscription: Record<string, unknown>;
  let repository: {
    findOne: jest.Mock;
    save: jest.Mock;
    manager: Record<string, unknown>;
  };
  let outboundMessageCreate: jest.Mock<
    Promise<unknown>,
    Parameters<OutboundMessagesService['create']>
  >;
  beforeEach(() => {
    subscription = {
      id: 'subscription-id',
      clinicId: 'clinic',
      planCode: MembershipPlanCode.free,
      licenseKeyHash: 'existing',
      providerSubscriptionId: 'I-123',
      updatedAt: new Date('2026-09-10T00:00:00.000Z'),
    };
    const transactionSubscriptionRepository = {
      findOne: jest.fn().mockResolvedValue(subscription),
      findOneByOrFail: jest.fn().mockResolvedValue(subscription),
      save: jest.fn((value: unknown) => Promise.resolve(value)),
    };
    const auditLogRepository = { save: jest.fn() };
    const clinicRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'clinic',
        name: 'Clinic',
        email: 'clinic@example.com',
      }),
    };
    const manager: Record<string, unknown> = {};
    Object.assign(manager, {
      query: jest.fn(),
      getRepository: jest.fn((entity: unknown) => {
        if (entity === ClinicSubscription)
          return transactionSubscriptionRepository;
        if (entity === ClinicSubscriptionAuditLog) return auditLogRepository;
        if (entity === Clinic) return clinicRepository;
        throw new Error('Unexpected transaction repository');
      }),
      transaction: jest.fn((callback: (value: unknown) => unknown) =>
        Promise.resolve(callback(manager)),
      ),
    });
    repository = {
      findOne: jest.fn().mockResolvedValue(subscription),
      save: jest.fn((value: unknown) => Promise.resolve(value)),
      manager,
    };
    outboundMessageCreate = jest
      .fn<Promise<unknown>, Parameters<OutboundMessagesService['create']>>()
      .mockResolvedValue({});
    const entitlements = {
      getLimits: jest.fn().mockReturnValue({
        professionalUsers: 1,
        totalUsers: 2,
        activePatients: null,
        storageBytes: 512 * 1024 * 1024,
        messagingCreditsMonthlyIncluded: 100,
      }),
      getEntitlements: jest.fn().mockReturnValue({ checkout: false }),
      getUsage: jest.fn().mockResolvedValue({
        totalUsers: 1,
        professionalUsers: 1,
        activePatients: 1,
        storageBytes: 0,
        messagingCreditsMonthlyIncluded: 0,
      }),
      buildWarnings: jest.fn().mockReturnValue({}),
    };
    service = new MembershipService(
      repository as unknown as ConstructorParameters<
        typeof MembershipService
      >[0],
      {
        create: outboundMessageCreate,
      } as unknown as ConstructorParameters<typeof MembershipService>[1],
      entitlements as unknown as MembershipEntitlementsService,
      new MembershipCheckoutIntentService(repository as never),
      {
        assignManual: jest.fn(),
        assignManualFromBackoffice: jest.fn(),
      } as never,
      new MembershipLicenseService(),
    );
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

  it('reuses the committed provider request ID for matching checkout retries', async () => {
    subscription.providerSubscriptionId = null;
    subscription.status = SubscriptionStatus.active;
    const input = {
      clinicId: 'clinic',
      fingerprint: 'same-options',
      trialRequested: true,
      checkoutQuote: { interval: 'yearly' } as never,
    };

    const first = await service.reserveProviderCheckout(input);
    const retry = await service.reserveProviderCheckout(input);

    expect(retry.requestId).toBe(first.requestId);
    expect(retry.quote).toEqual(input.checkoutQuote);
    await expect(
      service.reserveProviderCheckout({
        ...input,
        fingerprint: 'other-options',
      }),
    ).rejects.toThrow('checkout is already pending');
    expect(outboundMessageCreate).not.toHaveBeenCalled();
  });

  it('writes license delivery into the activation transaction', async () => {
    subscription.licenseKeyHash = null;

    await service.activateProviderSubscription({
      provider: BillingProvider.paypal,
      providerSubscriptionId: 'I-123',
      clinicId: 'clinic',
    });

    const [, message] = outboundMessageCreate.mock.calls[0];
    expect(message.payloadJson).toMatchObject({
      type: 'premium_license_issued',
    });
    expect(outboundMessageCreate.mock.calls[0][2]).toBe(repository.manager);
  });
});
