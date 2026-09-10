import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateClinicalRecordDto {
  @ApiProperty({ description: 'UUID del paciente' })
  @IsUUID()
  patientId: string;

  @ApiPropertyOptional({
    example: 'Penicilina',
    description: 'Alergias conocidas',
  })
  @IsString()
  @IsOptional()
  allergies?: string;

  @ApiPropertyOptional({
    example: 'Diabetes tipo 2',
    description: 'Enfermedades crónicas',
  })
  @IsString()
  @IsOptional()
  chronicDiseases?: string;

  @ApiPropertyOptional({
    example: 'Cirugías previas sin complicaciones',
    description: 'Antecedentes médicos generales',
  })
  @IsString()
  @IsOptional()
  medicalHistory?: string;

  @ApiPropertyOptional({
    example: 'Tratamiento de conducto en pieza 11',
    description: 'Antecedentes odontológicos',
  })
  @IsString()
  @IsOptional()
  dentalHistory?: string;

  @ApiPropertyOptional({
    example: 'Paciente ansioso en consulta',
    description: 'Observaciones clínicas generales',
  })
  @IsString()
  @IsOptional()
  observations?: string;
  @ApiPropertyOptional({
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    nullable: true,
  })
  @IsOptional()
  @IsIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
  bloodType?: string | null;

  @ApiPropertyOptional({
    description: 'Mutualista o cobertura médica',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  healthInsurance?: string | null;

  @ApiPropertyOptional({ description: 'Medicación habitual', nullable: true })
  @IsOptional()
  @IsString()
  currentMedication?: string | null;

  @ApiPropertyOptional({ description: 'Hábitos del paciente', nullable: true })
  @IsOptional()
  @IsString()
  habits?: string | null;
}
