import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsUUID } from 'class-validator';

export class QueryAgendaAppointmentsDto {
  @ApiProperty({ example: '2026-09-24T00:00:00.000Z' })
  @IsDateString()
  from: string;

  @ApiProperty({ example: '2026-09-25T00:00:00.000Z' })
  @IsDateString()
  to: string;

  @ApiProperty({ description: 'UUID de la membresía del profesional' })
  @IsUUID()
  professionalMembershipId: string;
}
