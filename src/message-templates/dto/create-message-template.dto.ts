import { i18nValidationMessage } from 'nestjs-i18n';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { NotificationChannel } from '../../common/interfaces/notification-channel.enum';
import { MessageTemplateStatus } from '../interfaces/message-template-status.enum';

export class CreateMessageTemplateDto {
  @ApiPropertyOptional({
    description:
      'UUID de la clínica. Opcional/deprecado en endpoints con x-clinic-id.',
  })
  @IsUUID(undefined, { message: i18nValidationMessage('validation.isUUID') })
  @IsOptional()
  clinicId?: string;

  @ApiProperty({
    enum: NotificationChannel,
    example: NotificationChannel.EMAIL,
    description: 'Canal de notificación',
  })
  @IsEnum(NotificationChannel, {
    message: i18nValidationMessage('validation.isEnum'),
  })
  channel: NotificationChannel;

  @ApiProperty({
    example: 'Recordatorio de cita',
    description: 'Nombre de la plantilla',
    minLength: 2,
    maxLength: 100,
  })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @MinLength(2, { message: i18nValidationMessage('validation.minLength') })
  @MaxLength(100, { message: i18nValidationMessage('validation.maxLength') })
  name: string;

  @ApiProperty({
    example: 'Estimado {{nombre}}, le recordamos su cita...',
    description: 'Cuerpo de la plantilla',
    minLength: 3,
  })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @MinLength(3, { message: i18nValidationMessage('validation.minLength') })
  body: string;

  @ApiPropertyOptional({
    enum: MessageTemplateStatus,
    example: MessageTemplateStatus.ACTIVE,
    description: 'Estado de la plantilla',
  })
  @IsEnum(MessageTemplateStatus, {
    message: i18nValidationMessage('validation.isEnum'),
  })
  @IsOptional()
  status?: MessageTemplateStatus;
}
