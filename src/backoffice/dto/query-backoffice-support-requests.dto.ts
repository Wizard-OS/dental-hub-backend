import { i18nValidationMessage } from 'nestjs-i18n';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

import { PaginationDto } from '../../common/dtos/pagination.dto';
import { SupportRequestStatus } from '../../help-center/entities/support-request.entity';

export class QueryBackofficeSupportRequestsDto extends PaginationDto {
  @ApiPropertyOptional({
    example: 'facturación',
    description: 'Busca por asunto, mensaje o email de contacto',
  })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    enum: SupportRequestStatus,
    example: SupportRequestStatus.OPEN,
    description: 'Filtra por estado de solicitud',
  })
  @IsEnum(SupportRequestStatus, {
    message: i18nValidationMessage('validation.isEnum'),
  })
  @IsOptional()
  status?: SupportRequestStatus;
}
