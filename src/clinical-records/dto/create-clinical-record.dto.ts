import { i18nValidationMessage } from 'nestjs-i18n';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateClinicalRecordDto {
  @ApiProperty({ description: 'UUID del paciente' })
  @IsUUID(undefined, { message: i18nValidationMessage('validation.isUUID') })
  patientId: string;

  @ApiPropertyOptional({
    example: 'Penicilina',
    description: 'Alergias conocidas',
  })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  allergies?: string;

  @ApiPropertyOptional({
    example: 'Diabetes tipo 2',
    description: 'Enfermedades crónicas',
  })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  chronicDiseases?: string;

  @ApiPropertyOptional({
    example: 'Cirugías previas sin complicaciones',
    description: 'Antecedentes médicos generales',
  })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  medicalHistory?: string;

  @ApiPropertyOptional({
    example: 'Tratamiento de conducto en pieza 11',
    description: 'Antecedentes odontológicos',
  })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  dentalHistory?: string;

  @ApiPropertyOptional({
    example: 'Paciente ansioso en consulta',
    description: 'Observaciones clínicas generales',
  })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  observations?: string;
  @ApiPropertyOptional({
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    nullable: true,
  })
  @IsOptional()
  @IsIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'], {
    message: i18nValidationMessage('validation.isIn'),
  })
  bloodType?: string | null;

  @ApiPropertyOptional({
    description: 'Mutualista o cobertura médica',
    nullable: true,
  })
  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.isString') })
  healthInsurance?: string | null;

  @ApiPropertyOptional({ description: 'Medicación habitual', nullable: true })
  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.isString') })
  currentMedication?: string | null;

  @ApiPropertyOptional({ description: 'Hábitos del paciente', nullable: true })
  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.isString') })
  habits?: string | null;
}
