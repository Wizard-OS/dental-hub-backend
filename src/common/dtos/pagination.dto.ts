import { i18nValidationMessage } from 'nestjs-i18n';
import { Type } from 'class-transformer';
import { IsOptional, IsPositive, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationDto {
  @ApiPropertyOptional({
    example: 10,
    description: 'Cantidad de registros por página',
  })
  @IsOptional()
  @IsPositive({ message: i18nValidationMessage('validation.isPositive') })
  @Type(() => Number) // enableImplicitConversions: true
  limit?: number;

  @ApiPropertyOptional({ example: 0, description: 'Desplazamiento (offset)' })
  @IsOptional()
  @Min(0, { message: i18nValidationMessage('validation.min') })
  @Type(() => Number) // enableImplicitConversions: true
  offset?: number;
}
