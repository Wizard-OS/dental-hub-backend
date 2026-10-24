import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsUUID, Matches } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

export class CreateTreatmentSessionDto {
  @ApiProperty({ description: 'UUID del registro clínico' })
  @IsUUID(undefined, { message: i18nValidationMessage('validation.isUUID') })
  clinicalRecordId: string;

  @ApiProperty({ description: 'UUID del tratamiento' })
  @IsUUID(undefined, { message: i18nValidationMessage('validation.isUUID') })
  treatmentId: string;

  @ApiProperty({
    example: '1500.00',
    description: 'Precio de la sesión (decimal string)',
  })
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: i18nValidationMessage('validation.matches'),
  })
  price: string;

  @ApiProperty({
    example: '2026-04-12T10:00:00.000Z',
    description: 'Fecha de la sesión (ISO 8601)',
  })
  @IsDateString(
    {},
    { message: i18nValidationMessage('validation.isDateString') },
  )
  performedAt: Date;
}
