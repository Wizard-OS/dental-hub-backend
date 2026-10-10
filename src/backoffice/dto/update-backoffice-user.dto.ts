import { i18nValidationMessage } from 'nestjs-i18n';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
} from 'class-validator';

import { ValidRoles } from '../../auth/interfaces';

export class UpdateBackofficeUserDto {
  @ApiPropertyOptional({
    example: true,
    description: 'Estado administrativo del usuario',
  })
  @IsBoolean({ message: i18nValidationMessage('validation.isBoolean') })
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    enum: ValidRoles,
    isArray: true,
    example: [ValidRoles.superUser],
    description: 'Roles globales del usuario',
  })
  @IsArray({ message: i18nValidationMessage('validation.isArray') })
  @ArrayNotEmpty({ message: i18nValidationMessage('validation.arrayNotEmpty') })
  @IsEnum(ValidRoles, {
    each: true,
    message: i18nValidationMessage('validation.isEnum'),
  })
  @IsOptional()
  roles?: ValidRoles[];
}
