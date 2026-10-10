import { i18nValidationMessage } from 'nestjs-i18n';
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
  @IsInt({ message: i18nValidationMessage('validation.isInt') })
  @Min(1, { message: i18nValidationMessage('validation.min') })
  @Max(7, { message: i18nValidationMessage('validation.max') })
  dayOfWeek: number;

  @ApiPropertyOptional({ example: true })
  @IsBoolean({ message: i18nValidationMessage('validation.isBoolean') })
  isOpen: boolean;

  @ApiPropertyOptional({ example: '09:00' })
  @IsOptional()
  @Matches(TIME_PATTERN, {
    message: i18nValidationMessage('validation.matches'),
  })
  startTime?: string;

  @ApiPropertyOptional({ example: '18:00' })
  @IsOptional()
  @Matches(TIME_PATTERN, {
    message: i18nValidationMessage('validation.matches'),
  })
  endTime?: string;
}

export class AppointmentBreakDto {
  @ApiPropertyOptional({ example: 'Almuerzo' })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @MaxLength(120, { message: i18nValidationMessage('validation.maxLength') })
  name: string;

  @ApiPropertyOptional({ example: [1, 2, 3, 4, 5] })
  @IsArray({ message: i18nValidationMessage('validation.isArray') })
  @ArrayMinSize(1, {
    message: i18nValidationMessage('validation.arrayMinSize'),
  })
  @ArrayMaxSize(7, {
    message: i18nValidationMessage('validation.arrayMaxSize'),
  })
  @ArrayUnique(undefined, {
    message: i18nValidationMessage('validation.arrayUnique'),
  })
  @IsInt({ each: true, message: i18nValidationMessage('validation.isInt') })
  @Min(1, { each: true, message: i18nValidationMessage('validation.min') })
  @Max(7, { each: true, message: i18nValidationMessage('validation.max') })
  daysOfWeek: number[];

  @ApiPropertyOptional({ example: '13:00' })
  @Matches(TIME_PATTERN, {
    message: i18nValidationMessage('validation.matches'),
  })
  startTime: string;

  @ApiPropertyOptional({ example: '14:00' })
  @Matches(TIME_PATTERN, {
    message: i18nValidationMessage('validation.matches'),
  })
  endTime: string;
}

export class AppointmentSpecialDateDto {
  @ApiPropertyOptional({ example: '2026-09-25' })
  @Matches(DATE_PATTERN, {
    message: i18nValidationMessage('validation.matches'),
  })
  date: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean({ message: i18nValidationMessage('validation.isBoolean') })
  isClosed: boolean;

  @ApiPropertyOptional({ example: 'Feriado' })
  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @MaxLength(160, { message: i18nValidationMessage('validation.maxLength') })
  reason?: string;

  @ApiPropertyOptional({ example: '10:00' })
  @IsOptional()
  @Matches(TIME_PATTERN, {
    message: i18nValidationMessage('validation.matches'),
  })
  startTime?: string;

  @ApiPropertyOptional({ example: '14:00' })
  @IsOptional()
  @Matches(TIME_PATTERN, {
    message: i18nValidationMessage('validation.matches'),
  })
  endTime?: string;
}

export class AppointmentAvailabilitySettingsDto {
  @ApiPropertyOptional({ enum: ['clinic', 'professional'] })
  @IsOptional()
  @IsIn(['clinic', 'professional'], {
    message: i18nValidationMessage('validation.isIn'),
  })
  scope?: 'clinic' | 'professional';

  @ApiPropertyOptional({ type: [AppointmentWorkingDayDto] })
  @IsOptional()
  @IsArray({ message: i18nValidationMessage('validation.isArray') })
  @ArrayMaxSize(7, {
    message: i18nValidationMessage('validation.arrayMaxSize'),
  })
  @ValidateNested({
    each: true,
    message: i18nValidationMessage('validation.nestedValidation'),
  })
  @Type(() => AppointmentWorkingDayDto)
  weekly?: AppointmentWorkingDayDto[];

  @ApiPropertyOptional({ type: [AppointmentBreakDto] })
  @IsOptional()
  @IsArray({ message: i18nValidationMessage('validation.isArray') })
  @ArrayMaxSize(20, {
    message: i18nValidationMessage('validation.arrayMaxSize'),
  })
  @ValidateNested({
    each: true,
    message: i18nValidationMessage('validation.nestedValidation'),
  })
  @Type(() => AppointmentBreakDto)
  breaks?: AppointmentBreakDto[];

  @ApiPropertyOptional({ type: [AppointmentSpecialDateDto] })
  @IsOptional()
  @IsArray({ message: i18nValidationMessage('validation.isArray') })
  @ArrayMaxSize(200, {
    message: i18nValidationMessage('validation.arrayMaxSize'),
  })
  @ValidateNested({
    each: true,
    message: i18nValidationMessage('validation.nestedValidation'),
  })
  @Type(() => AppointmentSpecialDateDto)
  specialDates?: AppointmentSpecialDateDto[];
}

export class AppointmentSchedulingSettingsDto {
  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsInt({ message: i18nValidationMessage('validation.isInt') })
  @Min(5, { message: i18nValidationMessage('validation.min') })
  @Max(480, { message: i18nValidationMessage('validation.max') })
  defaultDurationMin?: number;

  @ApiPropertyOptional({ example: 15 })
  @IsOptional()
  @IsInt({ message: i18nValidationMessage('validation.isInt') })
  @Min(5, { message: i18nValidationMessage('validation.min') })
  @Max(120, { message: i18nValidationMessage('validation.max') })
  slotIntervalMin?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt({ message: i18nValidationMessage('validation.isInt') })
  @Min(0, { message: i18nValidationMessage('validation.min') })
  @Max(180, { message: i18nValidationMessage('validation.max') })
  bufferBetweenAppointmentsMin?: number;
}

export class AppointmentReminderSettingsDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean({ message: i18nValidationMessage('validation.isBoolean') })
  enabled?: boolean;

  @ApiPropertyOptional({
    enum: NotificationChannel,
    isArray: true,
    example: [NotificationChannel.WHATSAPP, NotificationChannel.EMAIL],
  })
  @IsOptional()
  @IsArray({ message: i18nValidationMessage('validation.isArray') })
  @ArrayUnique(undefined, {
    message: i18nValidationMessage('validation.arrayUnique'),
  })
  @IsEnum(NotificationChannel, {
    each: true,
    message: i18nValidationMessage('validation.isEnum'),
  })
  channels?: NotificationChannel[];

  @ApiPropertyOptional({ example: [1440, 120] })
  @IsOptional()
  @IsArray({ message: i18nValidationMessage('validation.isArray') })
  @ArrayMaxSize(6, {
    message: i18nValidationMessage('validation.arrayMaxSize'),
  })
  @ArrayUnique(undefined, {
    message: i18nValidationMessage('validation.arrayUnique'),
  })
  @IsInt({ each: true, message: i18nValidationMessage('validation.isInt') })
  @Min(5, { each: true, message: i18nValidationMessage('validation.min') })
  @Max(43200, { each: true, message: i18nValidationMessage('validation.max') })
  noticesBeforeMinutes?: number[];

  @ApiPropertyOptional({
    example:
      'Hola, {nombre}. Te recordamos tu cita de {tipo} el {fecha} a las {hora}.',
  })
  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @MaxLength(500, { message: i18nValidationMessage('validation.maxLength') })
  messageTemplate?: string;
}

export class AppointmentConfirmationSettingsDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean({ message: i18nValidationMessage('validation.isBoolean') })
  enabled?: boolean;

  @ApiPropertyOptional({ example: 1440 })
  @IsOptional()
  @IsInt({ message: i18nValidationMessage('validation.isInt') })
  @Min(5, { message: i18nValidationMessage('validation.min') })
  @Max(43200, { message: i18nValidationMessage('validation.max') })
  requestBeforeMinutes?: number;

  @ApiPropertyOptional({ example: 120 })
  @IsOptional()
  @IsInt({ message: i18nValidationMessage('validation.isInt') })
  @Min(5, { message: i18nValidationMessage('validation.min') })
  @Max(43200, { message: i18nValidationMessage('validation.max') })
  responseDeadlineBeforeMinutes?: number;

  @ApiPropertyOptional({ enum: NotificationChannel })
  @IsOptional()
  @IsEnum(NotificationChannel, {
    message: i18nValidationMessage('validation.isEnum'),
  })
  channel?: NotificationChannel;

  @ApiPropertyOptional({
    enum: ['keep_pending', 'mark_unanswered', 'cancel'],
  })
  @IsOptional()
  @IsIn(['keep_pending', 'mark_unanswered', 'cancel'], {
    message: i18nValidationMessage('validation.isIn'),
  })
  noResponseAction?: 'keep_pending' | 'mark_unanswered' | 'cancel';

  @ApiPropertyOptional({
    example:
      'Hola, {nombre}. ¿Confirmas tu cita de {tipo} para el {fecha} a las {hora}?',
  })
  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @MaxLength(500, { message: i18nValidationMessage('validation.maxLength') })
  messageTemplate?: string;
}

export class AppointmentBookingRulesDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean({ message: i18nValidationMessage('validation.isBoolean') })
  patientBookingEnabled?: boolean;

  @ApiPropertyOptional({ example: 120 })
  @IsOptional()
  @IsInt({ message: i18nValidationMessage('validation.isInt') })
  @Min(0, { message: i18nValidationMessage('validation.min') })
  @Max(43200, { message: i18nValidationMessage('validation.max') })
  minNoticeMinutes?: number;

  @ApiPropertyOptional({ example: 60 })
  @IsOptional()
  @IsInt({ message: i18nValidationMessage('validation.isInt') })
  @Min(1, { message: i18nValidationMessage('validation.min') })
  @Max(730, { message: i18nValidationMessage('validation.max') })
  maxAdvanceDays?: number;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt({ message: i18nValidationMessage('validation.isInt') })
  @Min(1, { message: i18nValidationMessage('validation.min') })
  @Max(100, { message: i18nValidationMessage('validation.max') })
  maxActiveAppointmentsPerPatient?: number;

  @ApiPropertyOptional({ enum: ['automatic', 'manual'] })
  @IsOptional()
  @IsIn(['automatic', 'manual'], {
    message: i18nValidationMessage('validation.isIn'),
  })
  approvalMode?: 'automatic' | 'manual';
}

export class AppointmentCancellationRuleDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean({ message: i18nValidationMessage('validation.isBoolean') })
  enabled?: boolean;

  @ApiPropertyOptional({ example: 1440 })
  @IsOptional()
  @IsInt({ message: i18nValidationMessage('validation.isInt') })
  @Min(0, { message: i18nValidationMessage('validation.min') })
  @Max(43200, { message: i18nValidationMessage('validation.max') })
  minNoticeMinutes?: number;
}

export class AppointmentRescheduleRuleDto extends AppointmentCancellationRuleDto {
  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt({ message: i18nValidationMessage('validation.isInt') })
  @Min(0, { message: i18nValidationMessage('validation.min') })
  @Max(50, { message: i18nValidationMessage('validation.max') })
  maxChangesPerAppointment?: number;
}

export class AppointmentChangeRulesDto {
  @ApiPropertyOptional({ type: AppointmentCancellationRuleDto })
  @IsOptional()
  @ValidateNested({
    message: i18nValidationMessage('validation.nestedValidation'),
  })
  @Type(() => AppointmentCancellationRuleDto)
  cancellation?: AppointmentCancellationRuleDto;

  @ApiPropertyOptional({ type: AppointmentRescheduleRuleDto })
  @IsOptional()
  @ValidateNested({
    message: i18nValidationMessage('validation.nestedValidation'),
  })
  @Type(() => AppointmentRescheduleRuleDto)
  reschedule?: AppointmentRescheduleRuleDto;

  @ApiPropertyOptional({ enum: ['contact_clinic'] })
  @IsOptional()
  @IsIn(['contact_clinic'], {
    message: i18nValidationMessage('validation.isIn'),
  })
  outOfWindowAction?: 'contact_clinic';

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean({ message: i18nValidationMessage('validation.isBoolean') })
  notifyProfessional?: boolean;
}

export class UpdateAppointmentSettingsDto {
  @ApiPropertyOptional({ type: AppointmentAvailabilitySettingsDto })
  @IsOptional()
  @ValidateNested({
    message: i18nValidationMessage('validation.nestedValidation'),
  })
  @Type(() => AppointmentAvailabilitySettingsDto)
  availability?: AppointmentAvailabilitySettingsDto;

  @ApiPropertyOptional({ type: AppointmentSchedulingSettingsDto })
  @IsOptional()
  @ValidateNested({
    message: i18nValidationMessage('validation.nestedValidation'),
  })
  @Type(() => AppointmentSchedulingSettingsDto)
  scheduling?: AppointmentSchedulingSettingsDto;

  @ApiPropertyOptional({ type: AppointmentReminderSettingsDto })
  @IsOptional()
  @ValidateNested({
    message: i18nValidationMessage('validation.nestedValidation'),
  })
  @Type(() => AppointmentReminderSettingsDto)
  reminders?: AppointmentReminderSettingsDto;

  @ApiPropertyOptional({ type: AppointmentConfirmationSettingsDto })
  @IsOptional()
  @ValidateNested({
    message: i18nValidationMessage('validation.nestedValidation'),
  })
  @Type(() => AppointmentConfirmationSettingsDto)
  confirmation?: AppointmentConfirmationSettingsDto;

  @ApiPropertyOptional({ type: AppointmentBookingRulesDto })
  @IsOptional()
  @ValidateNested({
    message: i18nValidationMessage('validation.nestedValidation'),
  })
  @Type(() => AppointmentBookingRulesDto)
  bookingRules?: AppointmentBookingRulesDto;

  @ApiPropertyOptional({ type: AppointmentChangeRulesDto })
  @IsOptional()
  @ValidateNested({
    message: i18nValidationMessage('validation.nestedValidation'),
  })
  @Type(() => AppointmentChangeRulesDto)
  changeRules?: AppointmentChangeRulesDto;
}
