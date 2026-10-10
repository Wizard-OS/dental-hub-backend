import { i18nValidationMessage } from 'nestjs-i18n';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ClinicalQueryDto {
  @ApiPropertyOptional({ default: 30, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: i18nValidationMessage('validation.isInt') })
  @Min(1, { message: i18nValidationMessage('validation.min') })
  @Max(100, { message: i18nValidationMessage('validation.max') })
  limit = 30;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: i18nValidationMessage('validation.isInt') })
  @Min(0, { message: i18nValidationMessage('validation.min') })
  offset = 0;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString(
    {},
    { message: i18nValidationMessage('validation.isDateString') },
  )
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString(
    {},
    { message: i18nValidationMessage('validation.isDateString') },
  )
  to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.isString') })
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID(undefined, { message: i18nValidationMessage('validation.isUUID') })
  clinicalNoteId?: string;
}
