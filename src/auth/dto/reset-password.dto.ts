import { i18nValidationMessage } from 'nestjs-i18n';
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
    example: 'NewPass1',
    description: 'Nueva contraseña (mayúscula, minúscula y número)',
  })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @MinLength(6, { message: i18nValidationMessage('validation.minLength') })
  @MaxLength(50, { message: i18nValidationMessage('validation.maxLength') })
  @Matches(/(?:(?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message: i18nValidationMessage('validation.password'),
  })
  newPassword: string;
}
