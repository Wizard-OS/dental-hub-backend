import { i18nValidationMessage } from 'nestjs-i18n';
import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VoidPaymentDto {
  @ApiProperty({
    example: 'Pago cargado por error',
    description: 'Motivo de anulación',
  })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @MinLength(3, { message: i18nValidationMessage('validation.minLength') })
  reason: string;
}
