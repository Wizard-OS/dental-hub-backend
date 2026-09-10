import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsDate,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { PatientExamCategory } from '../entities/patient-exam.entity';

export class ExamMeasurementDto {
  @ApiProperty({ example: 'SNA' })
  @IsString()
  @Matches(/\S/)
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: 82 })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  value: number;

  @ApiPropertyOptional({ example: 'degrees' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ example: '82 ± 2' })
  @IsOptional()
  @IsString()
  reference?: string;
}

export class CreatePatientExamDto {
  @ApiProperty({ example: 'Mediciones cefalométricas' })
  @IsString()
  @Matches(/\S/)
  @MaxLength(200)
  title: string;

  @ApiProperty({ enum: PatientExamCategory })
  @IsEnum(PatientExamCategory)
  category: PatientExamCategory;

  @ApiProperty({ example: '2026-09-02T12:30:00Z' })
  @Type(() => Date)
  @IsDate()
  performedAt: Date;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  clinicalNoteId?: string | null;

  @ApiPropertyOptional({ type: [ExamMeasurementDto] })
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ExamMeasurementDto)
  measurements?: ExamMeasurementDto[];

  @ApiPropertyOptional({
    type: [String],
    description:
      'Archivos existentes del mismo paciente; [] elimina las asociaciones',
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  fileIds?: string[];
}

export class UpdatePatientExamDto extends PartialType(CreatePatientExamDto, {
  skipNullProperties: false,
}) {}
