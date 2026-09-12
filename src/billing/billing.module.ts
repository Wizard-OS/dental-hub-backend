import { MembershipEnrollment } from './entities/membership-enrollment.entity';
import { MembershipPaymentsController } from './membership-payments.controller';
import { MembershipWorker } from './membership-worker.service';
import { MembershipPaymentMethod } from './entities/membership-payment-method.entity';
import { MembershipSetupSession } from './entities/membership-setup-session.entity';
import { MembershipCharge } from './entities/membership-charge.entity';
import { PayPalVaultProvider } from './vault/paypal-vault.provider';
import { MembershipPaymentMethodsService } from './vault/membership-payment-methods.service';
import { MembershipRenewalsService } from './vault/membership-renewals.service';
import { MembershipEmailProvider } from './notifications/membership-email.provider';
import { MembershipRemindersService } from './notifications/membership-reminders.service';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Clinic } from '../clinics/entities/clinic.entity';
import { MembershipModule } from '../membership/membership.module';
import { OutboundMessagesModule } from '../outbound-messages/outbound-messages.module';
import { MembershipCheckoutController } from './membership-checkout.controller';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { BillingWebhookEvent } from './entities/billing-webhook-event.entity';
import { PayPalBillingProvider } from './providers/paypal-billing.provider';

@Module({
  controllers: [
    BillingController,
    MembershipCheckoutController,
    MembershipPaymentsController,
  ],
  providers: [
    BillingService,
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
      MembershipPaymentMethod,
      MembershipSetupSession,
      MembershipCharge,
      MembershipEnrollment,
    ]),
    MembershipModule,
    OutboundMessagesModule,
  ],
})
export class BillingModule {}
