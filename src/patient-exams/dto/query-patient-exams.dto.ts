import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ClinicalQueryDto } from '../../common/dtos/clinical-query.dto';
import { PatientExamCategory } from '../entities/patient-exam.entity';

export class QueryPatientExamsDto extends ClinicalQueryDto {
  @ApiPropertyOptional({ enum: PatientExamCategory })
  @IsOptional()
  @IsEnum(PatientExamCategory)
  category?: PatientExamCategory;
}
