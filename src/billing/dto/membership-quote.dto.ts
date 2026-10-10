import { i18nValidationMessage } from 'nestjs-i18n';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
} from 'class-validator';
import { BillingInterval } from '../interfaces/billing-interval.enum';

export class MembershipQuoteDto {
  @ApiProperty({ enum: BillingInterval, example: 'yearly' })
  @IsEnum(BillingInterval, {
    message: i18nValidationMessage('validation.isEnum'),
  })
  interval: BillingInterval;

  @ApiPropertyOptional({ example: 'BIENVENIDA10', nullable: true })
  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @MaxLength(64, { message: i18nValidationMessage('validation.maxLength') })
  promotionCode?: string | null;
}

export class ConfirmMembershipDto {
  @ApiProperty({ example: 'I-ABC123DEF456' })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @Matches(/^(I-[A-Z0-9]+|V-[a-f0-9-]{36})$/, {
    message: i18nValidationMessage('validation.matches'),
  })
  @MaxLength(64, { message: i18nValidationMessage('validation.maxLength') })
  providerSubscriptionId: string;
}
