import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

import { PatientFileType } from '../interfaces/patient-file-type.enum';

export class ImportPatientFileFromDriveDto {
  @ApiProperty({ description: 'File ID selected through Google Drive Picker' })
  @IsString()
  @MaxLength(1024)
  driveFileId: string;

  @ApiProperty({ enum: PatientFileType })
  @IsEnum(PatientFileType)
  type: PatientFileType;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  appointmentId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  clinicalNoteId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  treatmentId?: string;
}
