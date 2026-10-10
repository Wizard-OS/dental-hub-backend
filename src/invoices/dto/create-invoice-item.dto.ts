import { i18nValidationMessage } from 'nestjs-i18n';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { InvoiceItemType } from '../interfaces/invoice-item-type.enum';

export class CreateInvoiceItemDto {
  @ApiProperty({
    enum: InvoiceItemType,
    example: InvoiceItemType.custom,
    description: 'Tipo de ítem',
  })
  @IsEnum(InvoiceItemType, {
    message: i18nValidationMessage('validation.isEnum'),
  })
  type: InvoiceItemType;

  @ApiPropertyOptional({ description: 'UUID de referencia (cita o sesión)' })
  @IsUUID(undefined, { message: i18nValidationMessage('validation.isUUID') })
  @IsOptional()
  refId?: string;

  @ApiProperty({
    example: 'Consulta general',
    description: 'Descripción del ítem',
  })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  description: string;

  @ApiProperty({ example: 1, description: 'Cantidad (mín. 1)', minimum: 1 })
  @IsInt({ message: i18nValidationMessage('validation.isInt') })
  @Min(1, { message: i18nValidationMessage('validation.min') })
  qty: number;

  @ApiProperty({
    example: '500.00',
    description: 'Precio unitario (decimal string)',
  })
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: i18nValidationMessage('validation.matches'),
  })
  unitPrice: string;
}
