import { i18nValidationMessage } from 'nestjs-i18n';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ClinicalQueryDto } from '../../common/dtos/clinical-query.dto';
import { PatientExamCategory } from '../entities/patient-exam.entity';

export class QueryPatientExamsDto extends ClinicalQueryDto {
  @ApiPropertyOptional({ enum: PatientExamCategory })
  @IsOptional()
  @IsEnum(PatientExamCategory, {
    message: i18nValidationMessage('validation.isEnum'),
  })
  category?: PatientExamCategory;
}
