import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';

import { BillingProvider } from '../membership/interfaces/billing-provider.enum';
import { BillingWebhookService } from './billing-webhook.service';

describe('BillingWebhookService idempotency', () => {
  const payload = {
    id: 'event-1',
    event_type: 'BILLING.SUBSCRIPTION.UPDATED',
    resource: { id: 'subscription-1' },
  };

  function createService(
    claimedRows: Array<{ id: string }> = [{ id: 'event-row' }],
    existingEvents: Array<{ processedAt: Date | null }> = [],
  ) {
    const query = jest
      .fn()
      .mockResolvedValueOnce(claimedRows)
      .mockResolvedValue(existingEvents);
    const manager = { query };
    const webhookEventRepository = {
      manager,
      update: jest.fn().mockResolvedValue({ affected: 1 }),
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
      query,
      provider,
      renewals,
      reconciliation,
    };
  }

  it('claims and marks a new event processed after reconciliation succeeds', async () => {
    const { service, webhookEventRepository, query, reconciliation } =
      createService();

    await expect(
      service.handlePayPalWebhook({}, payload),
    ).resolves.toMatchObject({ duplicate: false, eventId: payload.id });

    expect(query).toHaveBeenCalledTimes(1);
    const claimCall = query.mock.calls[0] as unknown as [string, unknown[]];

    expect(claimCall[0]).toContain('ON CONFLICT');
    expect(claimCall[1]).toEqual(
      expect.arrayContaining([
        BillingProvider.paypal,
        payload.id,
        payload.event_type,
        'subscription-1',
      ]),
    );
    expect(reconciliation.processPayPalEvent).toHaveBeenCalledTimes(1);
    const updateCalls = webhookEventRepository.update.mock.calls as unknown as [
      { provider: BillingProvider; eventId: string; processingToken: string },
      {
        processedAt: Date;
        processingToken: null;
        processingUntil: null;
      },
    ][];

    expect(updateCalls[0]?.[0]).toMatchObject({
      provider: BillingProvider.paypal,
      eventId: payload.id,
    });
    expect(updateCalls[0]?.[0].processingToken).toMatch(/^[0-9a-f-]{36}$/i);
    expect(updateCalls[0]?.[1].processedAt).toBeInstanceOf(Date);
    expect(updateCalls[0]?.[1]).toMatchObject({
      processingToken: null,
      processingUntil: null,
    });
  });

  it('acknowledges a completed event that PayPal delivers again', async () => {
    const { service, webhookEventRepository, reconciliation, renewals } =
      createService([], [{ processedAt: new Date() }]);

    await expect(
      service.handlePayPalWebhook({}, payload),
    ).resolves.toMatchObject({ duplicate: true, eventId: payload.id });

    expect(webhookEventRepository.update).not.toHaveBeenCalled();
    expect(reconciliation.processPayPalEvent).not.toHaveBeenCalled();
    expect(renewals.handleProviderEvent).not.toHaveBeenCalled();
  });

  it('asks PayPal to retry while another worker owns the processing lease', async () => {
    const { service, webhookEventRepository } = createService(
      [],
      [{ processedAt: null }],
    );

    await expect(service.handlePayPalWebhook({}, payload)).rejects.toThrow(
      ServiceUnavailableException,
    );

    expect(webhookEventRepository.update).not.toHaveBeenCalled();
  });

  it('releases its claim when reconciliation fails so PayPal can retry', async () => {
    const { service, webhookEventRepository, reconciliation } = createService();

    reconciliation.processPayPalEvent.mockRejectedValue(
      new Error('provider error'),
    );

    await expect(service.handlePayPalWebhook({}, payload)).rejects.toThrow(
      'provider error',
    );

    expect(webhookEventRepository.update).toHaveBeenCalledTimes(1);
    const updateCalls = webhookEventRepository.update.mock.calls as unknown as [
      { processingToken: string },
      { processingToken: null; processingUntil: null },
    ][];

    expect(updateCalls[0]?.[0].processingToken).toMatch(/^[0-9a-f-]{36}$/i);
    expect(updateCalls[0]?.[1]).toEqual({
      processingToken: null,
      processingUntil: null,
    });
  });

  it('requires the stable provider event ID for idempotency', async () => {
    const { service, query } = createService();
    const payloadWithoutId = { ...payload, id: undefined };

    await expect(
      service.handlePayPalWebhook(
        { 'paypal-transmission-id': 'delivery-id' },
        payloadWithoutId,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(query).not.toHaveBeenCalled();
  });

  it('rejects events with an invalid signature before claiming work', async () => {
    const { service, provider, query } = createService();

    provider.verifyWebhook.mockResolvedValue({ verified: false });

    await expect(service.handlePayPalWebhook({}, payload)).rejects.toThrow();

    expect(query).not.toHaveBeenCalled();
  });
});
