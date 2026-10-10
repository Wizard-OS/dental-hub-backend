import { i18nValidationMessage } from 'nestjs-i18n';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsDate,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { PatientExamCategory } from '../entities/patient-exam.entity';

export class ExamMeasurementDto {
  @ApiProperty({ example: 'SNA' })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @Matches(/\S/, { message: i18nValidationMessage('validation.matches') })
  @MaxLength(120, { message: i18nValidationMessage('validation.maxLength') })
  name: string;

  @ApiProperty({ example: 82 })
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: i18nValidationMessage('validation.isNumber') },
  )
  value: number;

  @ApiPropertyOptional({ example: 'degrees' })
  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.isString') })
  unit?: string;

  @ApiPropertyOptional({ example: '82 ± 2' })
  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.isString') })
  reference?: string;
}

export class CreatePatientExamDto {
  @ApiProperty({ example: 'Mediciones cefalométricas' })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @Matches(/\S/, { message: i18nValidationMessage('validation.matches') })
  @MaxLength(200, { message: i18nValidationMessage('validation.maxLength') })
  title: string;

  @ApiProperty({ enum: PatientExamCategory })
  @IsEnum(PatientExamCategory, {
    message: i18nValidationMessage('validation.isEnum'),
  })
  category: PatientExamCategory;

  @ApiProperty({ example: '2026-09-02T12:30:00Z' })
  @Type(() => Date)
  @IsDate({ message: i18nValidationMessage('validation.isDate') })
  performedAt: Date;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.isString') })
  description?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID(undefined, { message: i18nValidationMessage('validation.isUUID') })
  clinicalNoteId?: string | null;

  @ApiPropertyOptional({ type: [ExamMeasurementDto] })
  @ValidateIf((_, value) => value !== undefined)
  @IsArray({ message: i18nValidationMessage('validation.isArray') })
  @ArrayMaxSize(200, {
    message: i18nValidationMessage('validation.arrayMaxSize'),
  })
  @ValidateNested({
    each: true,
    message: i18nValidationMessage('validation.nestedValidation'),
  })
  @Type(() => ExamMeasurementDto)
  measurements?: ExamMeasurementDto[];

  @ApiPropertyOptional({
    type: [String],
    description:
      'Archivos existentes del mismo paciente; [] elimina las asociaciones',
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsArray({ message: i18nValidationMessage('validation.isArray') })
  @ArrayMaxSize(100, {
    message: i18nValidationMessage('validation.arrayMaxSize'),
  })
  @ArrayUnique(undefined, {
    message: i18nValidationMessage('validation.arrayUnique'),
  })
  @IsUUID('all', {
    each: true,
    message: i18nValidationMessage('validation.isUUID'),
  })
  fileIds?: string[];
}

export class UpdatePatientExamDto extends PartialType(CreatePatientExamDto, {
  skipNullProperties: false,
}) {}
