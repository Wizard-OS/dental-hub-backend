import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IncomingHttpHeaders } from 'http';
import { Repository } from 'typeorm';
import { BillingProvider } from '../membership/interfaces/billing-provider.enum';
import { BillingWebhookEvent } from './entities/billing-webhook-event.entity';
import { PayPalBillingProvider } from './providers/paypal-billing.provider';
import { MembershipRenewalsService } from './vault/membership-renewals.service';
import {
  BillingSubscriptionReconciliationService,
  ProviderWebhookPayload,
} from './billing-subscription-reconciliation.service';

@Injectable()
export class BillingWebhookService {
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
      throw new UnauthorizedException('Invalid PayPal webhook signature');
    }

    const event = this.asWebhookPayload(payload);
    const eventId =
      event.id ?? this.getHeader(headers, 'paypal-transmission-id');
    const eventType = event.event_type;

    if (!eventId || !eventType) {
      throw new BadRequestException('Invalid PayPal webhook payload');
    }

    const providerSubscriptionId =
      this.reconciliation.extractProviderSubscriptionId(event) ?? null;
    const existing = await this.webhookEventRepository.findOne({
      where: { provider: BillingProvider.paypal, eventId },
    });

    if (existing?.processedAt) {
      return {
        received: true,
        duplicate: true,
        eventId,
        eventType,
      };
    }

    const savedEvent =
      existing ??
      (await this.webhookEventRepository.save(
        this.webhookEventRepository.create({
          provider: BillingProvider.paypal,
          eventId,
          eventType,
          providerSubscriptionId,
          payload: this.toRecord(payload),
          processedAt: null,
        }),
      ));

    if (
      eventType.startsWith('PAYMENT.CAPTURE.') ||
      eventType === 'CHECKOUT.ORDER.APPROVED'
    ) {
      await this.renewals.handleProviderEvent(eventType, event.resource ?? {});
    } else {
      await this.reconciliation.processPayPalEvent(
        this.paypalProvider,
        event,
        eventId,
      );
    }

    savedEvent.processedAt = new Date();
    await this.webhookEventRepository.save(savedEvent);

    return {
      received: true,
      duplicate: false,
      eventId,
      eventType,
    };
  }

  private asWebhookPayload(payload: unknown): ProviderWebhookPayload {
    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('Webhook payload must be an object');
    }

    return payload;
  }

  private getHeader(headers: IncomingHttpHeaders, name: string) {
    const value = headers[name];
    return typeof value === 'string' ? value : null;
  }

  private toRecord(payload: unknown): Record<string, unknown> {
    if (payload && typeof payload === 'object') {
      return payload as Record<string, unknown>;
    }

    return { value: payload };
  }
}
