import { randomUUID } from 'crypto';
import { IncomingHttpHeaders } from 'http';

import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { apiMessage } from '../common/i18n/api-message';
import { BillingProvider } from '../membership/interfaces/billing-provider.enum';
import {
  BillingSubscriptionReconciliationService,
  ProviderWebhookPayload,
} from './billing-subscription-reconciliation.service';
import { BillingWebhookEvent } from './entities/billing-webhook-event.entity';
import { PayPalBillingProvider } from './providers/paypal-billing.provider';
import { MembershipRenewalsService } from './vault/membership-renewals.service';

@Injectable()
export class BillingWebhookService {
  private readonly logger = new Logger(BillingWebhookService.name);

  constructor(
    @InjectRepository(BillingWebhookEvent)
    private readonly webhookEventRepository: Repository<BillingWebhookEvent>,
    private readonly paypalProvider: PayPalBillingProvider,
    private readonly renewals: MembershipRenewalsService,
    private readonly reconciliation: BillingSubscriptionReconciliationService,
  ) {}

  async handlePayPalWebhook(headers: IncomingHttpHeaders, payload: unknown) {
    const verification = await this.paypalProvider.verifyWebhook(
      headers,
      payload,
    );

    if (!verification.verified) {
      throw new UnauthorizedException(
        apiMessage('api.messages.invalid_paypal_webhook_signature'),
      );
    }

    const event = this.asWebhookPayload(payload);
    const eventId = typeof event.id === 'string' ? event.id.trim() : '';
    const eventType =
      typeof event.event_type === 'string' ? event.event_type.trim() : '';

    if (!eventId || !eventType) {
      throw new BadRequestException(
        apiMessage('api.messages.invalid_paypal_webhook_payload'),
      );
    }

    const providerSubscriptionId =
      this.reconciliation.extractProviderSubscriptionId(event) ?? null;
    const processingToken = randomUUID();
    const processingUntil = new Date(Date.now() + 15 * 60_000);
    const claimedEvents: Array<{ id: string }> =
      await this.webhookEventRepository.manager.query(
        `INSERT INTO billing_webhook_events (
           provider,
           "eventId",
           "eventType",
           "providerSubscriptionId",
           payload,
           "processedAt",
           "processingToken",
           "processingUntil"
         ) VALUES ($1, $2, $3, $4, $5, NULL, $6, $7)
         ON CONFLICT (provider, "eventId") DO UPDATE
         SET "processingToken" = EXCLUDED."processingToken",
             "processingUntil" = EXCLUDED."processingUntil"
         WHERE billing_webhook_events."processedAt" IS NULL
           AND (
             billing_webhook_events."processingUntil" IS NULL
             OR billing_webhook_events."processingUntil" <= CURRENT_TIMESTAMP
           )
         RETURNING id`,
        [
          BillingProvider.paypal,
          eventId,
          eventType,
          providerSubscriptionId,
          JSON.stringify(payload),
          processingToken,
          processingUntil,
        ],
      );

    if (claimedEvents.length === 0) {
      const existingEvents: Array<{
        processedAt: Date | null;
      }> = await this.webhookEventRepository.manager.query(
        `SELECT "processedAt"
         FROM billing_webhook_events
         WHERE provider = $1 AND "eventId" = $2`,
        [BillingProvider.paypal, eventId],
      );

      if (existingEvents[0]?.processedAt) {
        return {
          received: true,
          duplicate: true,
          eventId,
          eventType,
        };
      }

      // Ask the provider to retry while another worker owns the lease. If that
      // worker crashes, a later retry can claim the event after lease expiry.
      throw new ServiceUnavailableException();
    }

    try {
      if (
        eventType.startsWith('PAYMENT.CAPTURE.') ||
        eventType === 'CHECKOUT.ORDER.APPROVED'
      ) {
        await this.renewals.handleProviderEvent(
          eventType,
          event.resource ?? {},
        );
      } else {
        await this.reconciliation.processPayPalEvent(
          this.paypalProvider,
          event,
          eventId,
        );
      }

      const result = await this.webhookEventRepository.update(
        {
          provider: BillingProvider.paypal,
          eventId,
          processingToken,
        },
        {
          processedAt: new Date(),
          processingToken: null,
          processingUntil: null,
        },
      );

      if (result.affected !== 1) {
        throw new ServiceUnavailableException();
      }
    } catch (error) {
      await this.webhookEventRepository
        .update(
          {
            provider: BillingProvider.paypal,
            eventId,
            processingToken,
          },
          { processingToken: null, processingUntil: null },
        )
        .catch(() => {
          this.logger.warn(
            'Could not release a failed webhook claim; its lease will expire',
          );
        });

      throw error;
    }

    return {
      received: true,
      duplicate: false,
      eventId,
      eventType,
    };
  }

  private asWebhookPayload(payload: unknown): ProviderWebhookPayload {
    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException(
        apiMessage('api.messages.webhook_payload_must_be_an_object'),
      );
    }

    return payload;
  }
}
