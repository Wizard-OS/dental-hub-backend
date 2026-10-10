import { i18nValidationMessage } from 'nestjs-i18n';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { InvoiceStatus } from '../InvoiceStatus/InvoiceStatus.enum';
import { CreateInvoiceItemDto } from './create-invoice-item.dto';

export class CreateInvoiceDto {
  @ApiPropertyOptional({
    description:
      'UUID de la clínica. Opcional/deprecado en endpoints con x-clinic-id.',
  })
  @IsUUID(undefined, { message: i18nValidationMessage('validation.isUUID') })
  @IsOptional()
  clinicId?: string;

  @ApiProperty({ description: 'UUID del paciente' })
  @IsUUID(undefined, { message: i18nValidationMessage('validation.isUUID') })
  patientId: string;

  @ApiPropertyOptional({
    description: 'UUID del tratamiento relacionado al presupuesto',
  })
  @IsUUID(undefined, { message: i18nValidationMessage('validation.isUUID') })
  @IsOptional()
  treatmentId?: string;

  @ApiProperty({ example: 'INV-001', description: 'Número de factura' })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  number: string;

  @ApiPropertyOptional({
    enum: InvoiceStatus,
    example: InvoiceStatus.PENDING,
    description: 'Estado del documento comercial',
  })
  @IsEnum(InvoiceStatus, {
    message: i18nValidationMessage('validation.isEnum'),
  })
  @IsOptional()
  status?: InvoiceStatus;

  @ApiProperty({
    example: '1000.00',
    description: 'Subtotal (decimal string)',
  })
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: i18nValidationMessage('validation.matches'),
  })
  subtotal: string;

  @ApiProperty({
    example: '0.00',
    description: 'Descuento (decimal string)',
  })
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: i18nValidationMessage('validation.matches'),
  })
  discount: string;

  @ApiProperty({
    example: '160.00',
    description: 'Impuesto (decimal string)',
  })
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: i18nValidationMessage('validation.matches'),
  })
  tax: string;

  @ApiProperty({
    example: '1160.00',
    description: 'Monto total (decimal string)',
  })
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: i18nValidationMessage('validation.matches'),
  })
  totalAmount: string;

  @ApiPropertyOptional({
    example: '2026-05-01',
    description: 'Fecha de vencimiento',
  })
  @IsDateString(
    {},
    { message: i18nValidationMessage('validation.isDateString') },
  )
  @IsOptional()
  dueAt?: Date;

  @ApiPropertyOptional({
    example: 'Presupuesto válido por 15 días',
    description: 'Observaciones del presupuesto/factura',
  })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  observations?: string;

  @ApiPropertyOptional({
    type: [CreateInvoiceItemDto],
    description: 'Ítems de la factura',
  })
  @IsArray({ message: i18nValidationMessage('validation.isArray') })
  @ValidateNested({
    each: true,
    message: i18nValidationMessage('validation.nestedValidation'),
  })
  @Type(() => CreateInvoiceItemDto)
  @IsOptional()
  items?: CreateInvoiceItemDto[];
}
