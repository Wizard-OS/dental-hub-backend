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
  @IsUUID()
  @IsOptional()
  clinicId?: string;

  @ApiProperty({
    enum: NotificationChannel,
    example: NotificationChannel.EMAIL,
    description: 'Canal de notificación',
  })
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @ApiProperty({
    example: 'Recordatorio de cita',
    description: 'Nombre de la plantilla',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    example: 'Estimado {{nombre}}, le recordamos su cita...',
    description: 'Cuerpo de la plantilla',
    minLength: 3,
  })
  @IsString()
  @MinLength(3)
  body: string;

  @ApiPropertyOptional({
    enum: MessageTemplateStatus,
    example: MessageTemplateStatus.ACTIVE,
    description: 'Estado de la plantilla',
  })
  @IsEnum(MessageTemplateStatus)
  @IsOptional()
  status?: MessageTemplateStatus;
}
