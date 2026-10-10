import { i18nValidationMessage } from 'nestjs-i18n';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSupportRequestDto {
  @ApiProperty({
    example: 'Problema con facturación',
    description: 'Asunto de la solicitud',
    minLength: 3,
    maxLength: 200,
  })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @MinLength(3, { message: i18nValidationMessage('validation.minLength') })
  @MaxLength(200, { message: i18nValidationMessage('validation.maxLength') })
  subject: string;

  @ApiProperty({
    example: 'No puedo generar facturas desde ayer...',
    description: 'Mensaje detallado',
    minLength: 10,
    maxLength: 2000,
  })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @MinLength(10, { message: i18nValidationMessage('validation.minLength') })
  @MaxLength(2000, { message: i18nValidationMessage('validation.maxLength') })
  message: string;

  @ApiPropertyOptional({
    example: 'contacto@email.com',
    description: 'Email de contacto alternativo',
  })
  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsEmail({}, { message: i18nValidationMessage('validation.isEmail') })
  contactEmail?: string;
}
