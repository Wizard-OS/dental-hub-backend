import { Injectable } from '@nestjs/common';
import type { IncomingHttpHeaders } from 'http';
import {
  BillingHistoryRecord,
  BillingHistoryService,
} from './billing-history.service';
import { BillingInterval } from './interfaces/billing-interval.enum';
import { CreateBillingCheckoutDto } from './dto/create-billing-checkout.dto';
import { MembershipQuoteDto } from './dto/membership-quote.dto';
import { BillingCheckoutService } from './billing-checkout.service';
import { BillingSubscriptionService } from './billing-subscription.service';
import { BillingWebhookService } from './billing-webhook.service';

export type { BillingHistoryRecord } from './billing-history.service';

@Injectable()
export class BillingService {
  constructor(
    private readonly checkout: BillingCheckoutService,
    private readonly subscription: BillingSubscriptionService,
    private readonly billingHistory: BillingHistoryService,
    private readonly webhook: BillingWebhookService,
  ) {}

  getPlans() {
    return this.checkout.getPlans();
  }
  quote(clinicId: string, dto: MembershipQuoteDto) {
    return this.checkout.quote(clinicId, dto);
  }
  promotions(clinicId: string, interval: BillingInterval) {
    return this.checkout.promotions(clinicId, interval);
  }
  paymentMethods(clinicId: string) {
    return this.checkout.paymentMethods(clinicId);
  }
  createCheckout(
    clinicId: string,
    dto: CreateBillingCheckoutDto,
    actorId?: string,
  ) {
    return this.checkout.createCheckout(clinicId, dto, actorId);
  }
  confirm(clinicId: string, providerSubscriptionId?: string) {
    return this.subscription.confirm(clinicId, providerSubscriptionId);
  }
  cancel(clinicId: string) {
    return this.subscription.cancel(clinicId);
  }
  handlePayPalWebhook(headers: IncomingHttpHeaders, payload: unknown) {
    return this.webhook.handlePayPalWebhook(headers, payload);
  }
  getBillingHistory(clinicId: string): Promise<BillingHistoryRecord[]> {
    return this.billingHistory.getBillingHistory(clinicId);
  }
  exportBillingHistoryPdf(clinicId: string) {
    return this.billingHistory.exportBillingHistoryPdf(clinicId);
  }
}
