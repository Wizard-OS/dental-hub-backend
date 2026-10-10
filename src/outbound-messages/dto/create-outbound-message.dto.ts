import { i18nValidationMessage } from 'nestjs-i18n';
import { IsEnum, IsObject, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { NotificationChannel } from '../../common/interfaces/notification-channel.enum';
import { OutboundMessageStatus } from '../interfaces/outbound-message-status.enum';

export class CreateOutboundMessageDto {
  @ApiPropertyOptional({
    description:
      'UUID de la clínica. Opcional/deprecado en endpoints con x-clinic-id.',
  })
  @IsUUID(undefined, { message: i18nValidationMessage('validation.isUUID') })
  @IsOptional()
  clinicId?: string;

  @ApiPropertyOptional({ description: 'UUID del paciente' })
  @IsUUID(undefined, { message: i18nValidationMessage('validation.isUUID') })
  @IsOptional()
  patientId?: string;

  @ApiPropertyOptional({ description: 'UUID de la cita' })
  @IsUUID(undefined, { message: i18nValidationMessage('validation.isUUID') })
  @IsOptional()
  appointmentId?: string;

  @ApiPropertyOptional({ description: 'UUID de la plantilla de mensaje' })
  @IsUUID(undefined, { message: i18nValidationMessage('validation.isUUID') })
  @IsOptional()
  templateId?: string;

  @ApiProperty({
    enum: NotificationChannel,
    example: NotificationChannel.EMAIL,
    description: 'Canal de envío',
  })
  @IsEnum(NotificationChannel, {
    message: i18nValidationMessage('validation.isEnum'),
  })
  channel: NotificationChannel;

  @ApiPropertyOptional({
    example: { name: 'Juan' },
    description: 'Payload JSON del mensaje',
  })
  @IsObject({ message: i18nValidationMessage('validation.isObject') })
  @IsOptional()
  payloadJson?: Record<string, unknown>;

  @ApiPropertyOptional({
    enum: OutboundMessageStatus,
    example: OutboundMessageStatus.QUEUED,
    description: 'Estado del mensaje',
  })
  @IsEnum(OutboundMessageStatus, {
    message: i18nValidationMessage('validation.isEnum'),
  })
  @IsOptional()
  status?: OutboundMessageStatus;
}
