import { i18nValidationMessage } from 'nestjs-i18n';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethodType } from '../entities/payment-method.entity';

export class CreatePaymentMethodDto {
  @ApiProperty({
    enum: PaymentMethodType,
    example: PaymentMethodType.CARD,
    description: 'Tipo de método de pago',
  })
  @IsEnum(PaymentMethodType, {
    message: i18nValidationMessage('validation.isEnum'),
  })
  type: PaymentMethodType;

  @ApiProperty({
    example: 'Visa ****1234',
    description: 'Etiqueta del método de pago',
    minLength: 1,
    maxLength: 100,
  })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @MinLength(1, { message: i18nValidationMessage('validation.minLength') })
  @MaxLength(100, { message: i18nValidationMessage('validation.maxLength') })
  label: string;

  @ApiPropertyOptional({
    example: '1234',
    description: 'Últimos 4 dígitos',
    maxLength: 4,
  })
  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @MaxLength(4, { message: i18nValidationMessage('validation.maxLength') })
  last4?: string;

  @ApiPropertyOptional({
    example: 12,
    description: 'Mes de expiración (1-12)',
    minimum: 1,
    maximum: 12,
  })
  @IsOptional()
  @IsInt({ message: i18nValidationMessage('validation.isInt') })
  @Min(1, { message: i18nValidationMessage('validation.min') })
  @Max(12, { message: i18nValidationMessage('validation.max') })
  expiryMonth?: number;

  @ApiPropertyOptional({
    example: 2028,
    description: 'Año de expiración',
    minimum: 2024,
    maximum: 2100,
  })
  @IsOptional()
  @IsInt({ message: i18nValidationMessage('validation.isInt') })
  @Min(2024, { message: i18nValidationMessage('validation.min') })
  @Max(2100, { message: i18nValidationMessage('validation.max') })
  expiryYear?: number;
}
