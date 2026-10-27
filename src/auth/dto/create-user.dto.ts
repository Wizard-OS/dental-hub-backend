import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

import { MINIMUM_PASSWORD_LENGTH } from '../domain/password-policy';
import { PasswordByteLimit } from './password-bytes.validator';

export class CreateUserDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Correo electrónico del usuario',
  })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsEmail({}, { message: i18nValidationMessage('validation.isEmail') })
  email: string;

  @ApiProperty({
    example: 'a long dental passphrase',
    description: 'Contraseña (mínimo 15 caracteres, máximo 72 bytes UTF-8)',
    minLength: 15,
    maxLength: 72,
  })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @MinLength(MINIMUM_PASSWORD_LENGTH, {
    message: i18nValidationMessage('validation.minLength'),
  })
  @MaxLength(72, { message: i18nValidationMessage('validation.maxLength') })
  @PasswordByteLimit({
    message: i18nValidationMessage('validation.passwordByteLimit'),
  })
  password: string;

  @ApiProperty({ example: 'Juan', description: 'Nombre del usuario' })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @MinLength(1, { message: i18nValidationMessage('validation.minLength') })
  firstName: string;

  @ApiProperty({ example: 'Pérez', description: 'Apellido del usuario' })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @MinLength(1, { message: i18nValidationMessage('validation.minLength') })
  lastName: string;

  @ApiPropertyOptional({
    example: 'https://example.com/photo.jpg',
    description: 'URL de la foto de perfil',
  })
  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @MaxLength(2048, { message: i18nValidationMessage('validation.maxLength') })
  profilePhotoUrl?: string;
}
