import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

import { PatientFileType } from '../interfaces/patient-file-type.enum';

export class UpdatePatientFileDto {
  @ApiPropertyOptional({ enum: PatientFileType })
  @IsOptional()
  @IsEnum(PatientFileType)
  type?: PatientFileType;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  originalName?: string;

  @ApiPropertyOptional({ maxLength: 1000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;
}
