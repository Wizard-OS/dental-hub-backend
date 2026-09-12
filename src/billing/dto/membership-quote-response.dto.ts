import { ApiProperty } from '@nestjs/swagger';
import { BillingInterval } from '../interfaces/billing-interval.enum';
import type { MembershipQuote } from '../membership-offer';

export class MembershipQuoteResponseDto implements MembershipQuote {
  @ApiProperty({ enum: ['premium'] })
  planCode: 'premium';
  @ApiProperty({ example: 'DentalHub Premium' })
  name: string;
  @ApiProperty({ enum: BillingInterval })
  interval: BillingInterval;
  @ApiProperty({ enum: ['USD'] })
  currency: 'USD';
  @ApiProperty({ enum: ['minor'], description: 'Amounts are integer cents' })
  amountUnit: 'minor';
  @ApiProperty({ example: 10000 })
  subtotal: number;
  @ApiProperty({ example: 1000 })
  discount: number;
  @ApiProperty({ type: String, nullable: true, example: 'BIENVENIDA10' })
  promotionCode: string | null;
  @ApiProperty({ example: 9000 })
  firstCharge: number;
  @ApiProperty({ example: 0 })
  totalToday: number;
  @ApiProperty({ example: 10000 })
  renewalAmount: number;
  @ApiProperty({ example: 833 })
  monthlyEquivalent: number;
  @ApiProperty({ example: 17 })
  savingsPercent: number;
  @ApiProperty({ example: 14 })
  trialDays: number;
  @ApiProperty({ example: 2 })
  reminderDaysBeforeEnd: number;
  @ApiProperty({ example: true })
  autoRenew: boolean;
}

export class MembershipQuotePreviewResponseDto extends MembershipQuoteResponseDto {
  @ApiProperty()
  trialEligible: boolean;
  @ApiProperty()
  available: boolean;
  @ApiProperty()
  canCheckout: boolean;
}

export class SavedMembershipPaymentMethodDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ enum: ['card', 'paypal'] }) type: string;
  @ApiProperty({ type: String, nullable: true }) brand: string | null;
  @ApiProperty({ type: String, nullable: true, example: '4242' }) last4:
    string | null;
  @ApiProperty({ type: String, nullable: true, example: '2028-08' }) expiry:
    string | null;
  @ApiProperty({ type: String, nullable: true }) maskedEmail: string | null;
  @ApiProperty({ required: false }) isDefault?: boolean;
  @ApiProperty({ required: false }) expired?: boolean;
}
export class MembershipPaymentMethodsResponseDto {
  @ApiProperty({ type: [SavedMembershipPaymentMethodDto] })
  methods: SavedMembershipPaymentMethodDto[];
  @ApiProperty({ enum: ['saved_methods'] }) selectionMode: string;
  @ApiProperty({ enum: ['paypal'] }) provider: string;
  @ApiProperty() canAdd: boolean;
  @ApiProperty({ example: true }) canSelectSaved: boolean;
  @ApiProperty({ example: false }) requiresApproval: boolean;
  @ApiProperty({ type: [String], example: ['card', 'paypal'] })
  supportedTypes: string[];
}
export class MembershipSetupResponseDto {
  @ApiProperty({ format: 'uuid' }) setupSessionId: string;
  @ApiProperty() setupTokenId: string;
  @ApiProperty({ type: String, nullable: true }) approvalUrl: string | null;
  @ApiProperty() status: string;
  @ApiProperty({ enum: ['card', 'paypal'] }) type: string;
  @ApiProperty({ format: 'date-time' }) expiresAt: Date;
  @ApiProperty({ type: String, nullable: true }) cardEntry: string | null;
}
export class MembershipChargeResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) clinicId: string;
  @ApiProperty() agreementId: string;
  @ApiProperty() cycle: number;
  @ApiProperty({ description: 'Integer cents of USD' }) amount: number;
  @ApiProperty({ enum: ['USD'] }) currency: string;
  @ApiProperty() dueAt: Date;
  @ApiProperty() periodEnd: Date;
  @ApiProperty({
    enum: ['pending', 'paid', 'action_required', 'failed', 'refunded'],
  })
  status: string;
  @ApiProperty({ type: String, nullable: true }) providerOrderId: string | null;
  @ApiProperty({ type: String, nullable: true }) providerCaptureId:
    string | null;
  @ApiProperty({ type: String, nullable: true }) approvalUrl: string | null;
  @ApiProperty() attempts: number;
  @ApiProperty({ type: Date, nullable: true }) firstAttemptAt: Date | null;
  @ApiProperty({ type: Date, nullable: true }) nextAttemptAt: Date | null;
  @ApiProperty({ type: Date, nullable: true }) paidAt: Date | null;
  @ApiProperty({ type: String, nullable: true }) error: string | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}
