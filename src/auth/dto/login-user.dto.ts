import { i18nValidationMessage } from 'nestjs-i18n';
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginUserDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Correo electrónico',
  })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsEmail({}, { message: i18nValidationMessage('validation.isEmail') })
  email: string;

  @ApiProperty({
    example: 'Abc123',
    description: 'Contraseña',
    minLength: 6,
    maxLength: 50,
  })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @MinLength(6, { message: i18nValidationMessage('validation.minLength') })
  @MaxLength(50, { message: i18nValidationMessage('validation.maxLength') })
  @Matches(/(?:(?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message: i18nValidationMessage('validation.password'),
  })
  password: string;
}
