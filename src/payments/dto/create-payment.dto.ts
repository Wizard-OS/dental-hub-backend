import { i18nValidationMessage } from 'nestjs-i18n';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '../interfaces/payment-method.enum';

export class CreatePaymentDto {
  @ApiProperty({ description: 'UUID de la factura' })
  @IsUUID(undefined, { message: i18nValidationMessage('validation.isUUID') })
  invoiceId: string;

  @ApiPropertyOptional({ description: 'UUID del paciente' })
  @IsUUID(undefined, { message: i18nValidationMessage('validation.isUUID') })
  @IsOptional()
  patientId?: string;

  @ApiPropertyOptional({ description: 'UUID del tratamiento' })
  @IsUUID(undefined, { message: i18nValidationMessage('validation.isUUID') })
  @IsOptional()
  treatmentId?: string;

  @ApiProperty({
    example: '500.00',
    description: 'Monto del pago (decimal string)',
  })
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: i18nValidationMessage('validation.matches'),
  })
  amount: string;

  @ApiProperty({
    enum: PaymentMethod,
    example: PaymentMethod.CASH,
    description: 'Método de pago',
  })
  @IsEnum(PaymentMethod, {
    message: i18nValidationMessage('validation.isEnum'),
  })
  method: PaymentMethod;

  @ApiProperty({
    example: '2026-04-12T10:00:00.000Z',
    description: 'Fecha del pago (ISO 8601)',
  })
  @IsDateString(
    {},
    { message: i18nValidationMessage('validation.isDateString') },
  )
  paidAt: Date;

  @ApiPropertyOptional({
    example: 'REF-12345',
    description: 'Referencia del pago',
  })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  reference?: string;

  @ApiPropertyOptional({
    description: 'UUID de la membresía que recibió el pago',
  })
  @IsUUID(undefined, { message: i18nValidationMessage('validation.isUUID') })
  @IsOptional()
  receivedByMembershipId?: string;
}
