import { i18nValidationMessage } from 'nestjs-i18n';
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
  @IsIn(['card', 'paypal'], {
    message: i18nValidationMessage('validation.isIn'),
  })
  type: 'card' | 'paypal';
  @ApiProperty({
    format: 'uuid',
    description: 'Stable UUID for retries of this setup',
  })
  @IsUUID(undefined, { message: i18nValidationMessage('validation.isUUID') })
  requestId: string;
}
export class SelectMembershipPaymentMethodDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID(undefined, { message: i18nValidationMessage('validation.isUUID') })
  paymentMethodId: string;
}
export class ReconcileMembershipChargeDto {
  @ApiProperty({ description: 'PayPal order ID for this specific charge' })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @Matches(/^[A-Z0-9]+$/, {
    message: i18nValidationMessage('validation.matches'),
  })
  @MaxLength(64, { message: i18nValidationMessage('validation.maxLength') })
  providerOrderId: string;
}
export class StartMembershipDto extends MembershipQuoteDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID(undefined, { message: i18nValidationMessage('validation.isUUID') })
  paymentMethodId: string;
  @ApiProperty({ description: 'Explicit acceptance of recurring billing' })
  @Equals(true, { message: i18nValidationMessage('validation.equals') })
  acceptRecurringBilling: true;
  @ApiProperty({ format: 'uuid' })
  @IsUUID(undefined, { message: i18nValidationMessage('validation.isUUID') })
  requestId: string;
  @ApiProperty({
    required: false,
    description: 'Defaults to a trial only if eligible',
  })
  @IsOptional()
  @IsBoolean({ message: i18nValidationMessage('validation.isBoolean') })
  startTrial?: boolean;
}
