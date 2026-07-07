import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { AppointmentStatus } from '../interfaces/AppointmentStatus.enum';

export class CreateAppointmentDto {
  @ApiPropertyOptional({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description:
      'UUID de la clínica. Opcional/deprecado en endpoints con x-clinic-id.',
  })
  @IsUUID()
  @IsOptional()
  clinicId?: string;

  @ApiProperty({
    example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    description: 'UUID del paciente',
  })
  @IsUUID()
  patientId: string;

  @ApiPropertyOptional({
    example: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    description: 'UUID del dentista (usuario)',
  })
  @IsUUID()
  @IsOptional()
  dentistId?: string;

  @ApiPropertyOptional({ description: 'UUID de la membresía del profesional' })
  @IsUUID()
  @IsOptional()
  professionalMembershipId?: string;

  @ApiPropertyOptional({ description: 'UUID del tipo de cita' })
  @IsUUID()
  @IsOptional()
  appointmentTypeId?: string;

  @ApiProperty({
    example: 'Limpieza dental general',
    description: 'Descripción de la cita',
  })
  @IsString()
  description: string;

  @ApiProperty({
    example: '2026-04-15T09:00:00.000Z',
    description: 'Hora de inicio (ISO 8601)',
  })
  @IsDateString()
  startTime: Date;

  @ApiProperty({
    example: '2026-04-15T10:00:00.000Z',
    description: 'Hora de fin (ISO 8601)',
  })
  @IsDateString()
  endTime: Date;

  @ApiPropertyOptional({
    enum: AppointmentStatus,
    example: AppointmentStatus.SCHEDULED,
    description: 'Estado de la cita',
  })
  @IsEnum(AppointmentStatus)
  @IsOptional()
  status?: AppointmentStatus;

  @ApiPropertyOptional({
    example: 'Dolor de muela',
    description: 'Razón de la cita',
  })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiPropertyOptional({ description: 'Razón de cancelación' })
  @IsString()
  @IsOptional()
  cancelReason?: string;

  @ApiPropertyOptional({ description: 'UUID de la membresía que creó la cita' })
  @IsUUID()
  @IsOptional()
  createdByMembershipId?: string;
}
