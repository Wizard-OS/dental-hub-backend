import { i18nValidationMessage } from 'nestjs-i18n';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBooleanString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
export class QueryAppointmentTypesDto {
  @ApiPropertyOptional({ description: 'Buscar por nombre' })
  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @MaxLength(120, { message: i18nValidationMessage('validation.maxLength') })
  search?: string;

  @ApiPropertyOptional({ default: 'false' })
  @IsOptional()
  @IsBooleanString({
    message: i18nValidationMessage('validation.isBooleanString'),
  })
  includeInactive?: string;
}
