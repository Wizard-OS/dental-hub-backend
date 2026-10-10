import { i18nValidationMessage } from 'nestjs-i18n';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsBoolean,
  IsString,
  MaxLength,
  IsUUID,
  Equals,
} from 'class-validator';

import { MembershipPlanCode } from '../../membership/interfaces/membership-plan-code.enum';
import { BillingInterval } from '../interfaces/billing-interval.enum';

export class CreateBillingCheckoutDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Saved membership method; omit for legacy hosted checkout',
  })
  @IsOptional()
  @IsUUID(undefined, { message: i18nValidationMessage('validation.isUUID') })
  paymentMethodId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Required for saved-method checkout; preserve across retries',
  })
  @IsOptional()
  @IsUUID(undefined, { message: i18nValidationMessage('validation.isUUID') })
  requestId?: string;

  @ApiPropertyOptional({
    description: 'Required for saved-method recurring billing',
  })
  @IsOptional()
  @Equals(true, { message: i18nValidationMessage('validation.equals') })
  acceptRecurringBilling?: true;

  @ApiProperty({ enum: MembershipPlanCode })
  @IsEnum(MembershipPlanCode, {
    message: i18nValidationMessage('validation.isEnum'),
  })
  planCode: MembershipPlanCode;

  @ApiProperty({ enum: BillingInterval })
  @IsEnum(BillingInterval, {
    message: i18nValidationMessage('validation.isEnum'),
  })
  interval: BillingInterval;
  @ApiPropertyOptional({
    default: false,
    description: 'Use the 14-day membership offer',
  })
  @IsOptional()
  @IsBoolean({ message: i18nValidationMessage('validation.isBoolean') })
  startTrial?: boolean;

  @ApiPropertyOptional({ example: 'BIENVENIDA10', nullable: true })
  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @MaxLength(64, { message: i18nValidationMessage('validation.maxLength') })
  promotionCode?: string | null;
}
