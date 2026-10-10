import { i18nValidationMessage } from 'nestjs-i18n';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

import { PatientFileType } from '../interfaces/patient-file-type.enum';

export class CreatePatientFileDto {
  @ApiPropertyOptional({
    enum: PatientFileType,
    example: PatientFileType.RADIOGRAPHY,
  })
  @IsEnum(PatientFileType, {
    message: i18nValidationMessage('validation.isEnum'),
  })
  @IsOptional()
  type?: PatientFileType;

  @ApiPropertyOptional({ example: 'Radiografía panorámica inicial' })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'UUID de la cita asociada' })
  @IsUUID(undefined, { message: i18nValidationMessage('validation.isUUID') })
  @IsOptional()
  appointmentId?: string;

  @ApiPropertyOptional({ description: 'UUID de la evolución clínica asociada' })
  @IsUUID(undefined, { message: i18nValidationMessage('validation.isUUID') })
  @IsOptional()
  clinicalNoteId?: string;

  @ApiPropertyOptional({ description: 'UUID del tratamiento asociado' })
  @IsUUID(undefined, { message: i18nValidationMessage('validation.isUUID') })
  @IsOptional()
  treatmentId?: string;
}
