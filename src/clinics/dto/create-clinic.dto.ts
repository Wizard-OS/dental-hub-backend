import { i18nValidationMessage } from 'nestjs-i18n';
import {
  IsEmail,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateClinicDto {
  @ApiProperty({
    example: 'Dental Clinic Center',
    description: 'Nombre de la clínica',
  })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @Length(2, 120, { message: i18nValidationMessage('validation.length') })
  name: string;

  @ApiPropertyOptional({ example: '+59824000000', description: 'Teléfono' })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @MaxLength(60, { message: i18nValidationMessage('validation.maxLength') })
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({
    example: 'contacto@dentalhub.com',
    description: 'Email de contacto',
  })
  @IsEmail({}, { message: i18nValidationMessage('validation.isEmail') })
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    example: 'Av. 18 de Julio 1234',
    description: 'Dirección',
  })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @MaxLength(240, { message: i18nValidationMessage('validation.maxLength') })
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({
    example: 'https://example.com/logo.png',
    description: 'URL del logo',
  })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @MaxLength(2048, { message: i18nValidationMessage('validation.maxLength') })
  @IsOptional()
  logoUrl?: string;

  @ApiPropertyOptional({
    example: 'America/Mexico_City',
    description: 'Zona horaria',
  })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  timezone?: string;

  @ApiPropertyOptional({
    example: 'UY',
    description: 'Código ISO alpha-2 del país de la clínica',
  })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @Matches(/^[A-Za-z]{2}$/, {
    message: i18nValidationMessage('validation.matches'),
  })
  @IsOptional()
  countryCode?: string;

  @ApiPropertyOptional({ example: 'MXN', description: 'Moneda' })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({
    example: { monday: [{ from: '09:00', to: '18:00' }] },
    description: 'Horarios generales de atención',
  })
  @IsObject({ message: i18nValidationMessage('validation.isObject') })
  @IsOptional()
  workingHoursJson?: Record<string, unknown>;
}
