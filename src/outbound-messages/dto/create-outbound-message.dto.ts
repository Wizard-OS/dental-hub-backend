import { IsEnum, IsObject, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { NotificationChannel } from '../../common/interfaces/notification-channel.enum';
import { OutboundMessageStatus } from '../interfaces/outbound-message-status.enum';

export class CreateOutboundMessageDto {
  @ApiPropertyOptional({
    description:
      'UUID de la clínica. Opcional/deprecado en endpoints con x-clinic-id.',
  })
  @IsUUID()
  @IsOptional()
  clinicId?: string;

  @ApiPropertyOptional({ description: 'UUID del paciente' })
  @IsUUID()
  @IsOptional()
  patientId?: string;

  @ApiPropertyOptional({ description: 'UUID de la cita' })
  @IsUUID()
  @IsOptional()
  appointmentId?: string;

  @ApiPropertyOptional({ description: 'UUID de la plantilla de mensaje' })
  @IsUUID()
  @IsOptional()
  templateId?: string;

  @ApiProperty({
    enum: NotificationChannel,
    example: NotificationChannel.EMAIL,
    description: 'Canal de envío',
  })
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @ApiPropertyOptional({
    example: { name: 'Juan' },
    description: 'Payload JSON del mensaje',
  })
  @IsObject()
  @IsOptional()
  payloadJson?: Record<string, unknown>;

  @ApiPropertyOptional({
    enum: OutboundMessageStatus,
    example: OutboundMessageStatus.QUEUED,
    description: 'Estado del mensaje',
  })
  @IsEnum(OutboundMessageStatus)
  @IsOptional()
  status?: OutboundMessageStatus;
}
