import { i18nValidationMessage } from 'nestjs-i18n';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { AppointmentStatus } from '../interfaces/AppointmentStatus.enum';
import { AppointmentConfirmationStatus } from '../interfaces/appointment-confirmation-status.enum';

export class CreateAppointmentDto {
  @ApiPropertyOptional({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description:
      'UUID de la clínica. Opcional/deprecado en endpoints con x-clinic-id.',
  })
  @IsUUID(undefined, { message: i18nValidationMessage('validation.isUUID') })
  @IsOptional()
  clinicId?: string;

  @ApiProperty({
    example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    description: 'UUID del paciente',
  })
  @IsUUID(undefined, { message: i18nValidationMessage('validation.isUUID') })
  patientId: string;

  @ApiPropertyOptional({
    example: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    description: 'UUID del dentista (usuario)',
  })
  @IsUUID(undefined, { message: i18nValidationMessage('validation.isUUID') })
  @IsOptional()
  dentistId?: string;

  @ApiPropertyOptional({ description: 'UUID de la membresía del profesional' })
  @IsUUID(undefined, { message: i18nValidationMessage('validation.isUUID') })
  @IsOptional()
  professionalMembershipId?: string;

  @ApiPropertyOptional({ description: 'UUID del tipo de cita' })
  @IsUUID(undefined, { message: i18nValidationMessage('validation.isUUID') })
  @IsOptional()
  appointmentTypeId?: string;

  @ApiProperty({
    example: 'Limpieza dental general',
    description: 'Descripción de la cita',
  })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  description: string;

  @ApiProperty({
    example: '2026-04-15T09:00:00.000Z',
    description: 'Hora de inicio (ISO 8601)',
  })
  @IsDateString(
    {},
    { message: i18nValidationMessage('validation.isDateString') },
  )
  startTime: Date;

  @ApiProperty({
    example: '2026-04-15T10:00:00.000Z',
    description: 'Hora de fin (ISO 8601)',
  })
  @IsDateString(
    {},
    { message: i18nValidationMessage('validation.isDateString') },
  )
  endTime: Date;

  @ApiPropertyOptional({
    enum: AppointmentStatus,
    example: AppointmentStatus.SCHEDULED,
    description: 'Estado de la cita',
  })
  @IsEnum(AppointmentStatus, {
    message: i18nValidationMessage('validation.isEnum'),
  })
  @IsOptional()
  status?: AppointmentStatus;

  @ApiPropertyOptional({
    enum: AppointmentConfirmationStatus,
    example: AppointmentConfirmationStatus.PENDING,
    description: 'Estado de confirmación de asistencia',
  })
  @IsEnum(AppointmentConfirmationStatus, {
    message: i18nValidationMessage('validation.isEnum'),
  })
  @IsOptional()
  confirmationStatus?: AppointmentConfirmationStatus;

  @ApiPropertyOptional({
    example: '2026-09-14T10:00:00.000Z',
    description: 'Fecha/hora en que se solicitó confirmación',
  })
  @IsDateString(
    {},
    { message: i18nValidationMessage('validation.isDateString') },
  )
  @IsOptional()
  confirmationRequestedAt?: Date;

  @ApiPropertyOptional({
    example: '2026-09-14T12:00:00.000Z',
    description: 'Fecha/hora en que el paciente confirmó',
  })
  @IsDateString(
    {},
    { message: i18nValidationMessage('validation.isDateString') },
  )
  @IsOptional()
  confirmedAt?: Date;

  @ApiPropertyOptional({
    example: '2026-09-14T12:30:00.000Z',
    description: 'Fecha/hora del último cambio de horario solicitado',
  })
  @IsDateString(
    {},
    { message: i18nValidationMessage('validation.isDateString') },
  )
  @IsOptional()
  lastRescheduledAt?: Date;

  @ApiPropertyOptional({
    example: 1,
    description: 'Cantidad de reprogramaciones realizadas para la cita',
  })
  @IsInt({ message: i18nValidationMessage('validation.isInt') })
  @Min(0, { message: i18nValidationMessage('validation.min') })
  @IsOptional()
  rescheduleCount?: number;

  @ApiPropertyOptional({
    example: 'Dolor de muela',
    description: 'Razón de la cita',
  })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  reason?: string;

  @ApiPropertyOptional({ description: 'Razón de cancelación' })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  cancelReason?: string;

  @ApiPropertyOptional({ description: 'UUID de la membresía que creó la cita' })
  @IsUUID(undefined, { message: i18nValidationMessage('validation.isUUID') })
  @IsOptional()
  createdByMembershipId?: string;
}
