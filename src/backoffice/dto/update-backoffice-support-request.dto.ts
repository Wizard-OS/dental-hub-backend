import { i18nValidationMessage } from 'nestjs-i18n';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

import { SupportRequestStatus } from '../../help-center/entities/support-request.entity';

export class UpdateBackofficeSupportRequestDto {
  @ApiProperty({
    enum: SupportRequestStatus,
    example: SupportRequestStatus.IN_PROGRESS,
    description: 'Nuevo estado de la solicitud',
  })
  @IsEnum(SupportRequestStatus, {
    message: i18nValidationMessage('validation.isEnum'),
  })
  status: SupportRequestStatus;
}
