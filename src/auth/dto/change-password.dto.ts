import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

import { MINIMUM_PASSWORD_LENGTH } from '../domain/password-policy';
import { PasswordByteLimit } from './password-bytes.validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'OldPass1', description: 'Contraseña actual' })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @MinLength(6, { message: i18nValidationMessage('validation.minLength') })
  @MaxLength(72, { message: i18nValidationMessage('validation.maxLength') })
  currentPassword: string;

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
