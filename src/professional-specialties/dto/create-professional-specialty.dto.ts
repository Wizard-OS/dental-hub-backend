import { i18nValidationMessage } from 'nestjs-i18n';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateProfessionalSpecialtyDto {
  @ApiProperty({ example: 'Ortodoncia' })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @MinLength(2, { message: i18nValidationMessage('validation.minLength') })
  @MaxLength(100, { message: i18nValidationMessage('validation.maxLength') })
  name: string;

  @ApiPropertyOptional({ example: 'ortodoncia' })
  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @MinLength(2, { message: i18nValidationMessage('validation.minLength') })
  @MaxLength(80, { message: i18nValidationMessage('validation.maxLength') })
  code?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean({ message: i18nValidationMessage('validation.isBoolean') })
  isActive?: boolean;
}
