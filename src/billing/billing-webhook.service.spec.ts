import { BillingProvider } from '../membership/interfaces/billing-provider.enum';
import { BillingWebhookEvent } from './entities/billing-webhook-event.entity';
import { BillingWebhookService } from './billing-webhook.service';

describe('BillingWebhookService idempotency', () => {
  const payload = {
    id: 'event-1',
    event_type: 'BILLING.SUBSCRIPTION.UPDATED',
    resource: { id: 'subscription-1' },
  };

  function createService(existingEvent: BillingWebhookEvent | null) {
    const webhookEventRepository = {
      findOne: jest.fn().mockResolvedValue(existingEvent),
      create: jest.fn((event: BillingWebhookEvent) => event),
      save: jest.fn((event: BillingWebhookEvent) => Promise.resolve(event)),
    };
    const provider = {
      verifyWebhook: jest.fn().mockResolvedValue({ verified: true }),
    };
    const renewals = { handleProviderEvent: jest.fn() };
    const reconciliation = {
      extractProviderSubscriptionId: jest
        .fn()
        .mockReturnValue('subscription-1'),
      processPayPalEvent: jest.fn().mockResolvedValue(undefined),
    };

    return {
      service: new BillingWebhookService(
        webhookEventRepository as never,
        provider as never,
        renewals as never,
        reconciliation as never,
      ),
      webhookEventRepository,
      provider,
      renewals,
      reconciliation,
    };
  }

  it('skips completed events that PayPal delivers again', async () => {
    const { service, webhookEventRepository, reconciliation, renewals } =
      createService({
        provider: BillingProvider.paypal,
        eventId: payload.id,
        eventType: payload.event_type,
        processedAt: new Date(),
      } as BillingWebhookEvent);

    await expect(
      service.handlePayPalWebhook({}, payload),
    ).resolves.toMatchObject({ duplicate: true, eventId: payload.id });

    expect(webhookEventRepository.save).not.toHaveBeenCalled();
    expect(reconciliation.processPayPalEvent).not.toHaveBeenCalled();
    expect(renewals.handleProviderEvent).not.toHaveBeenCalled();
  });

  it('marks a new event processed only after reconciliation succeeds', async () => {
    const { service, webhookEventRepository, reconciliation } =
      createService(null);

    await expect(
      service.handlePayPalWebhook({}, payload),
    ).resolves.toMatchObject({ duplicate: false, eventId: payload.id });

    expect(reconciliation.processPayPalEvent).toHaveBeenCalledTimes(1);
    expect(webhookEventRepository.save).toHaveBeenCalledTimes(2);
    expect(
      webhookEventRepository.save.mock.calls[1][0].processedAt,
    ).toBeInstanceOf(Date);
  });
});
