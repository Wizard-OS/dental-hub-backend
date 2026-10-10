import { i18nValidationMessage } from 'nestjs-i18n';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { ToothStatus } from '../interfaces/tooth-status.enum';
import { ToothSurface } from '../interfaces/tooth-surface.enum';

export class UpdateOdontogramToothDto {
  @ApiProperty({
    enum: ToothStatus,
    example: ToothStatus.CARIES,
    description: 'Estado de la pieza dental',
  })
  @IsEnum(ToothStatus, { message: i18nValidationMessage('validation.isEnum') })
  status: ToothStatus;

  @ApiPropertyOptional({
    enum: ToothSurface,
    isArray: true,
    example: [ToothSurface.OCCLUSAL],
    description:
      'Superficies afectadas. Si se omite, se registra la pieza completa.',
  })
  @IsArray({ message: i18nValidationMessage('validation.isArray') })
  @ArrayNotEmpty({ message: i18nValidationMessage('validation.arrayNotEmpty') })
  @IsEnum(ToothSurface, {
    each: true,
    message: i18nValidationMessage('validation.isEnum'),
  })
  @IsOptional()
  surfaces?: ToothSurface[];

  @ApiPropertyOptional({ example: 'Lesión oclusal visible' })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  observation?: string;

  @ApiPropertyOptional({ example: 'Caries inicial en fosa central' })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'Restauración de resina' })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  treatmentType?: string;

  @ApiPropertyOptional({
    description: 'UUID de la evolución clínica asociada',
  })
  @IsUUID(undefined, { message: i18nValidationMessage('validation.isUUID') })
  @IsOptional()
  clinicalNoteId?: string;

  @ApiPropertyOptional({
    description: 'UUID del tratamiento asociado',
  })
  @IsUUID(undefined, { message: i18nValidationMessage('validation.isUUID') })
  @IsOptional()
  treatmentId?: string;
}
