import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { ClinicalQueryDto } from '../../common/dtos/clinical-query.dto';
export class QueryClinicalNotesDto extends ClinicalQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  authorMembershipId?: string;
}
