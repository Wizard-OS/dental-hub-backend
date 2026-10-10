import { i18nValidationMessage } from 'nestjs-i18n';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBooleanString, IsOptional } from 'class-validator';

import { PaginationDto } from '../../common/dtos/pagination.dto';

export class QueryPatientsDto extends PaginationDto {
  @ApiPropertyOptional({
    example: 'true',
    description:
      'Incluye pacientes archivados. Solo disponible para roles que gestionan pacientes.',
  })
  @IsBooleanString({
    message: i18nValidationMessage('validation.isBooleanString'),
  })
  @IsOptional()
  includeArchived?: string;
}
