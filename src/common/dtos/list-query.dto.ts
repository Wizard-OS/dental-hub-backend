import { ApiPropertyOptional } from '@nestjs/swagger';

import { PaginationDto } from './pagination.dto';

export class ListQueryDto extends PaginationDto {
  @ApiPropertyOptional({ default: 30, maximum: 100 })
  override limit = 30;

  @ApiPropertyOptional({ default: 0 })
  override offset = 0;
}
