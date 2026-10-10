import { i18nValidationMessage } from 'nestjs-i18n';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

import { PatientFileType } from '../interfaces/patient-file-type.enum';

export class ImportPatientFileFromDriveDto {
  @ApiProperty({ description: 'File ID selected through Google Drive Picker' })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @MaxLength(1024, { message: i18nValidationMessage('validation.maxLength') })
  driveFileId: string;

  @ApiProperty({ enum: PatientFileType })
  @IsEnum(PatientFileType, {
    message: i18nValidationMessage('validation.isEnum'),
  })
  type: PatientFileType;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @MaxLength(1000, { message: i18nValidationMessage('validation.maxLength') })
  description?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID(undefined, { message: i18nValidationMessage('validation.isUUID') })
  appointmentId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID(undefined, { message: i18nValidationMessage('validation.isUUID') })
  clinicalNoteId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID(undefined, { message: i18nValidationMessage('validation.isUUID') })
  treatmentId?: string;
}
