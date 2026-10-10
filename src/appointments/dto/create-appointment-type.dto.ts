import { i18nValidationMessage } from 'nestjs-i18n';
import { Transform } from 'class-transformer';
import type { TransformFnParams } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAppointmentTypeDto {
  @ApiPropertyOptional({
    description:
      'UUID de la clínica. Opcional/deprecado en endpoints con x-clinic-id.',
  })
  @IsUUID(undefined, { message: i18nValidationMessage('validation.isUUID') })
  @IsOptional()
  clinicId?: string;

  @ApiProperty({ example: 'Limpieza', description: 'Nombre del tipo de cita' })
  @Transform(({ value }: TransformFnParams) => {
    const transformValue: unknown = value;
    return typeof transformValue === 'string'
      ? transformValue.trim()
      : transformValue;
  })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @Matches(/\S/, { message: i18nValidationMessage('validation.matches') })
  @MaxLength(120, { message: i18nValidationMessage('validation.maxLength') })
  name: string;

  @ApiProperty({
    example: 30,
    description: 'Duración en minutos (mín. 5)',
    minimum: 5,
  })
  @IsInt({ message: i18nValidationMessage('validation.isInt') })
  @Min(5, { message: i18nValidationMessage('validation.min') })
  durationMin: number;

  @ApiPropertyOptional({
    nullable: true,
    example: '500.00',
    description: 'Precio por defecto (decimal string)',
  })
  @IsOptional()
  @Matches(/^\d{1,10}(\.\d{1,2})?$/, {
    message: i18nValidationMessage('validation.matches'),
  })
  defaultPrice?: string | null;

  @ApiPropertyOptional({ example: '#3498db', description: 'Color en hex' })
  @ValidateIf((_, value) => value !== undefined)
  @Matches(/^#[0-9a-fA-F]{6}$/, {
    message: i18nValidationMessage('validation.matches'),
  })
  color?: string;

  @ApiPropertyOptional({ example: 'UYU', default: 'UYU' })
  @ValidateIf((_, value) => value !== undefined)
  @Matches(/^[A-Z]{3}$/, {
    message: i18nValidationMessage('validation.matches'),
  })
  currency?: string;

  @ApiPropertyOptional({ example: true, description: '¿Activo?' })
  @IsBoolean({ message: i18nValidationMessage('validation.isBoolean') })
  @IsOptional()
  isActive?: boolean;
}
