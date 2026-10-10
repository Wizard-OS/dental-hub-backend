import { i18nValidationMessage } from 'nestjs-i18n';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ example: 'OldPass1', description: 'Contraseña actual' })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @MinLength(6, { message: i18nValidationMessage('validation.minLength') })
  @MaxLength(50, { message: i18nValidationMessage('validation.maxLength') })
  currentPassword: string;

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
