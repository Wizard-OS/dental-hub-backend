import { i18nValidationMessage } from 'nestjs-i18n';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationDto {
  @ApiPropertyOptional({
    example: 10,
    description: 'Cantidad de registros por página',
  })
  @IsOptional()
  @IsInt({ message: i18nValidationMessage('validation.isInt') })
  @Min(1, { message: i18nValidationMessage('validation.min') })
  @Max(100, { message: i18nValidationMessage('validation.max') })
  @Type(() => Number) // enableImplicitConversions: true
  limit?: number;

  @ApiPropertyOptional({ example: 0, description: 'Desplazamiento (offset)' })
  @IsOptional()
  @IsInt({ message: i18nValidationMessage('validation.isInt') })
  @Min(0, { message: i18nValidationMessage('validation.min') })
  @Type(() => Number) // enableImplicitConversions: true
  offset?: number;
}
