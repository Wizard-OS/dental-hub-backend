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
  @IsUUID()
  @IsOptional()
  clinicId?: string;

  @ApiProperty({ description: 'UUID del paciente' })
  @IsUUID()
  patientId: string;

  @ApiProperty({ example: 'INV-001', description: 'Número de factura' })
  @IsString()
  number: string;

  @ApiProperty({
    enum: InvoiceStatus,
    example: InvoiceStatus.PENDING,
    description: 'Estado de la factura',
  })
  @IsEnum(InvoiceStatus)
  status: InvoiceStatus;

  @ApiProperty({
    example: '1000.00',
    description: 'Subtotal (decimal string)',
  })
  @Matches(/^\d+(\.\d{1,2})?$/)
  subtotal: string;

  @ApiProperty({
    example: '0.00',
    description: 'Descuento (decimal string)',
  })
  @Matches(/^\d+(\.\d{1,2})?$/)
  discount: string;

  @ApiProperty({
    example: '160.00',
    description: 'Impuesto (decimal string)',
  })
  @Matches(/^\d+(\.\d{1,2})?$/)
  tax: string;

  @ApiProperty({
    example: '1160.00',
    description: 'Monto total (decimal string)',
  })
  @Matches(/^\d+(\.\d{1,2})?$/)
  totalAmount: string;

  @ApiPropertyOptional({
    example: '2026-05-01',
    description: 'Fecha de vencimiento',
  })
  @IsDateString()
  @IsOptional()
  dueAt?: Date;

  @ApiPropertyOptional({
    type: [CreateInvoiceItemDto],
    description: 'Ítems de la factura',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  @IsOptional()
  items?: CreateInvoiceItemDto[];
}
