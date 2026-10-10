import { i18nValidationMessage } from 'nestjs-i18n';
import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsUUID } from 'class-validator';

export class QueryAgendaAppointmentsDto {
  @ApiProperty({ example: '2026-09-24T00:00:00.000Z' })
  @IsDateString(
    {},
    { message: i18nValidationMessage('validation.isDateString') },
  )
  from: string;

  @ApiProperty({ example: '2026-09-25T00:00:00.000Z' })
  @IsDateString(
    {},
    { message: i18nValidationMessage('validation.isDateString') },
  )
  to: string;

  @ApiProperty({ description: 'UUID de la membresía del profesional' })
  @IsUUID(undefined, { message: i18nValidationMessage('validation.isUUID') })
  professionalMembershipId: string;
}
