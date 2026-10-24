import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Clinic } from '../clinics/entities/clinic.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { MembershipModule } from '../membership/membership.module';
import { OutboundMessagesModule } from '../outbound-messages/outbound-messages.module';
import { Payment } from '../payments/entities/payment.entity';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { BillingCheckoutService } from './billing-checkout.service';
import { BillingHistoryController } from './billing-history.controller';
import { BillingHistoryService } from './billing-history.service';
import { BillingSubscriptionService } from './billing-subscription.service';
import { BillingSubscriptionReconciliationService } from './billing-subscription-reconciliation.service';
import { BillingWebhookService } from './billing-webhook.service';
import { BillingWebhookEvent } from './entities/billing-webhook-event.entity';
import { MembershipCharge } from './entities/membership-charge.entity';
import { MembershipEnrollment } from './entities/membership-enrollment.entity';
import { MembershipPaymentMethod } from './entities/membership-payment-method.entity';
import { MembershipSetupSession } from './entities/membership-setup-session.entity';
import { MembershipCheckoutController } from './membership-checkout.controller';
import { MembershipPaymentsController } from './membership-payments.controller';
import { MembershipWorker } from './membership-worker.service';
import { MembershipEmailProvider } from './notifications/membership-email.provider';
import { MembershipRemindersService } from './notifications/membership-reminders.service';
import { PayPalBillingProvider } from './providers/paypal-billing.provider';
import { MembershipPaymentMethodsService } from './vault/membership-payment-methods.service';
import { MembershipRenewalsService } from './vault/membership-renewals.service';
import { PayPalVaultProvider } from './vault/paypal-vault.provider';

@Module({
  controllers: [
    BillingController,
    BillingHistoryController,
    MembershipCheckoutController,
    MembershipPaymentsController,
  ],
  providers: [
    BillingService,
    BillingCheckoutService,
    BillingSubscriptionService,
    BillingWebhookService,
    BillingSubscriptionReconciliationService,
    BillingHistoryService,
    PayPalBillingProvider,
    PayPalVaultProvider,
    MembershipPaymentMethodsService,
    MembershipRenewalsService,
    MembershipEmailProvider,
    MembershipRemindersService,
    MembershipWorker,
  ],
  imports: [
    TypeOrmModule.forFeature([
      BillingWebhookEvent,
      Clinic,
      Invoice,
      MembershipPaymentMethod,
      MembershipSetupSession,
      MembershipCharge,
      MembershipEnrollment,
      Payment,
    ]),
    MembershipModule,
    OutboundMessagesModule,
  ],
})
export class BillingModule {}
