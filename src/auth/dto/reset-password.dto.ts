import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

import { MINIMUM_PASSWORD_LENGTH } from '../domain/password-policy';
import { PasswordByteLimit } from './password-bytes.validator';

export class ResetPasswordDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Correo electrónico del usuario',
  })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsEmail({}, { message: i18nValidationMessage('validation.isEmail') })
  email: string;

  @ApiProperty({
    example: '123456',
    description: 'Código OTP de 6 dígitos',
  })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @Matches(/^\d{6}$/, { message: i18nValidationMessage('validation.otp') })
  otp: string;

  @ApiProperty({
    example: 'a new dental passphrase',
    description:
      'Nueva contraseña (mínimo 15 caracteres, máximo 72 bytes UTF-8)',
  })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @MinLength(MINIMUM_PASSWORD_LENGTH, {
    message: i18nValidationMessage('validation.minLength'),
  })
  @MaxLength(72, { message: i18nValidationMessage('validation.maxLength') })
  @PasswordByteLimit({
    message: i18nValidationMessage('validation.passwordByteLimit'),
  })
  newPassword: string;
}
