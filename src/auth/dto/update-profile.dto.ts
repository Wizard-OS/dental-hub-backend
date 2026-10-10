import { i18nValidationMessage } from 'nestjs-i18n';
import {
  IsEmail,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Juan', description: 'Nombre' })
  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @MinLength(1, { message: i18nValidationMessage('validation.minLength') })
  @MaxLength(100, { message: i18nValidationMessage('validation.maxLength') })
  firstName?: string;

  @ApiPropertyOptional({ example: 'Pérez', description: 'Apellido' })
  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @MinLength(1, { message: i18nValidationMessage('validation.minLength') })
  @MaxLength(100, { message: i18nValidationMessage('validation.maxLength') })
  lastName?: string;

  @ApiPropertyOptional({
    example: 'new@example.com',
    description: 'Correo electrónico',
  })
  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsEmail({}, { message: i18nValidationMessage('validation.isEmail') })
  email?: string;

  @ApiPropertyOptional({ example: '+5491112345678', description: 'Teléfono' })
  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @MaxLength(20, { message: i18nValidationMessage('validation.maxLength') })
  phone?: string;

  @ApiPropertyOptional({
    example: '1988-05-12T00:00:00.000Z',
    description: 'Fecha de nacimiento',
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: i18nValidationMessage('validation.isDateString') },
  )
  birthDate?: string;

  @ApiPropertyOptional({
    example: 'CJPPU-12345',
    description: 'Número de caja profesional',
  })
  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @MaxLength(80, { message: i18nValidationMessage('validation.maxLength') })
  professionalLicenseNumber?: string;

  @ApiPropertyOptional({
    example: '28d89310-5dc9-45ee-9db6-1b1f7b9da44f',
    description: 'Especialidad profesional',
  })
  @IsOptional()
  @IsUUID(undefined, { message: i18nValidationMessage('validation.isUUID') })
  professionalSpecialtyId?: string;

  @ApiPropertyOptional({ example: '210000000018', description: 'RUT' })
  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @MaxLength(30, { message: i18nValidationMessage('validation.maxLength') })
  rut?: string;
}
