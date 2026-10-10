import { i18nValidationMessage } from 'nestjs-i18n';
import { IsEmail, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyOtpDto {
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
}
