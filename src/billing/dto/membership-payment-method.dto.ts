import { MembershipQuoteDto } from './membership-quote.dto';
import { ApiProperty } from '@nestjs/swagger';
import {
  Equals,
  IsIn,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  IsOptional,
  IsBoolean,
} from 'class-validator';

export class CreateMembershipPaymentMethodDto {
  @ApiProperty({ enum: ['card', 'paypal'] })
  @IsIn(['card', 'paypal'])
  type: 'card' | 'paypal';
  @ApiProperty({
    format: 'uuid',
    description: 'Stable UUID for retries of this setup',
  })
  @IsUUID()
  requestId: string;
}
export class SelectMembershipPaymentMethodDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  paymentMethodId: string;
}
export class ReconcileMembershipChargeDto {
  @ApiProperty({ description: 'PayPal order ID for this specific charge' })
  @IsString()
  @Matches(/^[A-Z0-9]+$/)
  @MaxLength(64)
  providerOrderId: string;
}
export class StartMembershipDto extends MembershipQuoteDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  paymentMethodId: string;
  @ApiProperty({ description: 'Explicit acceptance of recurring billing' })
  @Equals(true)
  acceptRecurringBilling: true;
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  requestId: string;
  @ApiProperty({
    required: false,
    description: 'Defaults to a trial only if eligible',
  })
  @IsOptional()
  @IsBoolean()
  startTrial?: boolean;
}
