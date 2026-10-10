import { i18nValidationMessage } from 'nestjs-i18n';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

import { PatientFileType } from '../interfaces/patient-file-type.enum';

export class UpdatePatientFileDto {
  @ApiPropertyOptional({ enum: PatientFileType })
  @IsOptional()
  @IsEnum(PatientFileType, {
    message: i18nValidationMessage('validation.isEnum'),
  })
  type?: PatientFileType;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @MaxLength(255, { message: i18nValidationMessage('validation.maxLength') })
  originalName?: string;

  @ApiPropertyOptional({ maxLength: 1000, nullable: true })
  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @MaxLength(1000, { message: i18nValidationMessage('validation.maxLength') })
  description?: string | null;
}
