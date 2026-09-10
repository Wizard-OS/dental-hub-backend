import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

import { NotificationChannel } from '../../common/interfaces/notification-channel.enum';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class AppointmentWorkingDayDto {
  @ApiPropertyOptional({ example: 1, description: '1=Lunes, 7=Domingo' })
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek: number;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  isOpen: boolean;

  @ApiPropertyOptional({ example: '09:00' })
  @IsOptional()
  @Matches(TIME_PATTERN)
  startTime?: string;

  @ApiPropertyOptional({ example: '18:00' })
  @IsOptional()
  @Matches(TIME_PATTERN)
  endTime?: string;
}

export class AppointmentBreakDto {
  @ApiPropertyOptional({ example: 'Almuerzo' })
  @IsString()
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({ example: [1, 2, 3, 4, 5] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  daysOfWeek: number[];

  @ApiPropertyOptional({ example: '13:00' })
  @Matches(TIME_PATTERN)
  startTime: string;

  @ApiPropertyOptional({ example: '14:00' })
  @Matches(TIME_PATTERN)
  endTime: string;
}

export class AppointmentSpecialDateDto {
  @ApiPropertyOptional({ example: '2026-09-25' })
  @Matches(DATE_PATTERN)
  date: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  isClosed: boolean;

  @ApiPropertyOptional({ example: 'Feriado' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  reason?: string;

  @ApiPropertyOptional({ example: '10:00' })
  @IsOptional()
  @Matches(TIME_PATTERN)
  startTime?: string;

  @ApiPropertyOptional({ example: '14:00' })
  @IsOptional()
  @Matches(TIME_PATTERN)
  endTime?: string;
}

export class AppointmentAvailabilitySettingsDto {
  @ApiPropertyOptional({ enum: ['clinic', 'professional'] })
  @IsOptional()
  @IsIn(['clinic', 'professional'])
  scope?: 'clinic' | 'professional';

  @ApiPropertyOptional({ type: [AppointmentWorkingDayDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => AppointmentWorkingDayDto)
  weekly?: AppointmentWorkingDayDto[];

  @ApiPropertyOptional({ type: [AppointmentBreakDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => AppointmentBreakDto)
  breaks?: AppointmentBreakDto[];

  @ApiPropertyOptional({ type: [AppointmentSpecialDateDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => AppointmentSpecialDateDto)
  specialDates?: AppointmentSpecialDateDto[];
}

export class AppointmentSchedulingSettingsDto {
  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(480)
  defaultDurationMin?: number;

  @ApiPropertyOptional({ example: 15 })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(120)
  slotIntervalMin?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(180)
  bufferBetweenAppointmentsMin?: number;
}

export class AppointmentReminderSettingsDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({
    enum: NotificationChannel,
    isArray: true,
    example: [NotificationChannel.WHATSAPP, NotificationChannel.EMAIL],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(NotificationChannel, { each: true })
  channels?: NotificationChannel[];

  @ApiPropertyOptional({ example: [1440, 120] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(5, { each: true })
  @Max(43200, { each: true })
  noticesBeforeMinutes?: number[];

  @ApiPropertyOptional({
    example:
      'Hola, {nombre}. Te recordamos tu cita de {tipo} el {fecha} a las {hora}.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  messageTemplate?: string;
}

export class AppointmentConfirmationSettingsDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ example: 1440 })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(43200)
  requestBeforeMinutes?: number;

  @ApiPropertyOptional({ example: 120 })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(43200)
  responseDeadlineBeforeMinutes?: number;

  @ApiPropertyOptional({ enum: NotificationChannel })
  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;

  @ApiPropertyOptional({
    enum: ['keep_pending', 'mark_unanswered', 'cancel'],
  })
  @IsOptional()
  @IsIn(['keep_pending', 'mark_unanswered', 'cancel'])
  noResponseAction?: 'keep_pending' | 'mark_unanswered' | 'cancel';

  @ApiPropertyOptional({
    example:
      'Hola, {nombre}. ¿Confirmas tu cita de {tipo} para el {fecha} a las {hora}?',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  messageTemplate?: string;
}

export class AppointmentBookingRulesDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  patientBookingEnabled?: boolean;

  @ApiPropertyOptional({ example: 120 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(43200)
  minNoticeMinutes?: number;

  @ApiPropertyOptional({ example: 60 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(730)
  maxAdvanceDays?: number;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxActiveAppointmentsPerPatient?: number;

  @ApiPropertyOptional({ enum: ['automatic', 'manual'] })
  @IsOptional()
  @IsIn(['automatic', 'manual'])
  approvalMode?: 'automatic' | 'manual';
}

export class AppointmentCancellationRuleDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ example: 1440 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(43200)
  minNoticeMinutes?: number;
}

export class AppointmentRescheduleRuleDto extends AppointmentCancellationRuleDto {
  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  maxChangesPerAppointment?: number;
}

export class AppointmentChangeRulesDto {
  @ApiPropertyOptional({ type: AppointmentCancellationRuleDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AppointmentCancellationRuleDto)
  cancellation?: AppointmentCancellationRuleDto;

  @ApiPropertyOptional({ type: AppointmentRescheduleRuleDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AppointmentRescheduleRuleDto)
  reschedule?: AppointmentRescheduleRuleDto;

  @ApiPropertyOptional({ enum: ['contact_clinic'] })
  @IsOptional()
  @IsIn(['contact_clinic'])
  outOfWindowAction?: 'contact_clinic';

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  notifyProfessional?: boolean;
}

export class UpdateAppointmentSettingsDto {
  @ApiPropertyOptional({ type: AppointmentAvailabilitySettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AppointmentAvailabilitySettingsDto)
  availability?: AppointmentAvailabilitySettingsDto;

  @ApiPropertyOptional({ type: AppointmentSchedulingSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AppointmentSchedulingSettingsDto)
  scheduling?: AppointmentSchedulingSettingsDto;

  @ApiPropertyOptional({ type: AppointmentReminderSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AppointmentReminderSettingsDto)
  reminders?: AppointmentReminderSettingsDto;

  @ApiPropertyOptional({ type: AppointmentConfirmationSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AppointmentConfirmationSettingsDto)
  confirmation?: AppointmentConfirmationSettingsDto;

  @ApiPropertyOptional({ type: AppointmentBookingRulesDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AppointmentBookingRulesDto)
  bookingRules?: AppointmentBookingRulesDto;

  @ApiPropertyOptional({ type: AppointmentChangeRulesDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AppointmentChangeRulesDto)
  changeRules?: AppointmentChangeRulesDto;
}
