import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

export class CreatePatientAssignmentDto {
  @ApiProperty({ description: 'UUID del paciente' })
  @IsUUID(undefined, { message: i18nValidationMessage('validation.isUUID') })
  patientId: string;

  @ApiProperty({ description: 'UUID de la membresía profesional secundaria' })
  @IsUUID(undefined, { message: i18nValidationMessage('validation.isUUID') })
  professionalMembershipId: string;
}
