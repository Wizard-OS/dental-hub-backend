import { i18nValidationMessage } from 'nestjs-i18n';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateOdontogramPdfDto {
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

  @ApiPropertyOptional({ example: 'Odontograma inicial exportado' })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  description?: string;
}
