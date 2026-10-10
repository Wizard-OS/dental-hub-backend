import { i18nValidationMessage } from 'nestjs-i18n';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  MaxLength,
  ValidateIf,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateClinicalNoteDto {
  @ApiProperty({ description: 'UUID del registro clínico' })
  @IsUUID(undefined, { message: i18nValidationMessage('validation.isUUID') })
  clinicalRecordId: string;

  @ApiProperty({
    example: 'Se realizó limpieza dental profunda',
    description: 'Contenido de la nota clínica',
    minLength: 3,
  })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @MinLength(3, { message: i18nValidationMessage('validation.minLength') })
  content: string;

  @ApiPropertyOptional({ example: 'Dolor al masticar' })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  reason?: string;

  @ApiPropertyOptional({ example: 'Caries profunda pieza 36' })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  diagnosis?: string;

  @ApiPropertyOptional({ example: 'Restauración temporal' })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  procedure?: string;

  @ApiPropertyOptional({ example: 'Control en 7 días' })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  indications?: string;

  @ApiPropertyOptional({ example: 'Paciente tolera bien el procedimiento' })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  observations?: string;

  @ApiPropertyOptional({
    example: ['36'],
    description: 'Piezas dentales asociadas a la evolución',
  })
  @IsArray({ message: i18nValidationMessage('validation.isArray') })
  @IsString({
    each: true,
    message: i18nValidationMessage('validation.isString'),
  })
  @IsOptional()
  toothCodes?: string[];
  @ApiPropertyOptional({ example: 'Control de ortodoncia' })
  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @MinLength(1, { message: i18nValidationMessage('validation.minLength') })
  @MaxLength(200, { message: i18nValidationMessage('validation.maxLength') })
  title?: string;

  @ApiPropertyOptional({
    description: 'Fecha efectiva de consulta; por defecto ahora',
    example: '2026-09-08T13:00:00Z',
  })
  @ValidateIf((_, value) => value !== undefined)
  @Type(() => Date)
  @IsDate({ message: i18nValidationMessage('validation.isDate') })
  occurredAt?: Date;
}
