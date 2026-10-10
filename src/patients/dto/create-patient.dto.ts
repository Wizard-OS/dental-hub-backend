import { i18nValidationMessage } from 'nestjs-i18n';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Gender } from '../../common/interfaces/gender.enum';

export class CreatePatientDto {
  @ApiPropertyOptional({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description:
      'UUID de la clínica. Opcional/deprecado en endpoints con x-clinic-id.',
  })
  @IsUUID(undefined, { message: i18nValidationMessage('validation.isUUID') })
  @IsOptional()
  clinicId?: string;

  @ApiPropertyOptional({
    example: 'paciente@email.com',
    description: 'Email del paciente',
  })
  @IsOptional()
  @IsEmail({}, { message: i18nValidationMessage('validation.isEmail') })
  email?: string;

  @ApiProperty({ example: 'María', description: 'Nombre del paciente' })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  firstName: string;

  @ApiProperty({ example: 'López', description: 'Apellido del paciente' })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  lastName: string;

  @ApiPropertyOptional({
    example: 'UY-12345678',
    description: 'Documento o identificación del paciente',
  })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @MaxLength(80, { message: i18nValidationMessage('validation.maxLength') })
  @IsOptional()
  documentId?: string;

  @ApiProperty({
    example: '1990-05-15',
    description: 'Fecha de nacimiento (ISO 8601)',
  })
  @IsDateString(
    {},
    { message: i18nValidationMessage('validation.isDateString') },
  )
  birthDate: Date;

  @ApiProperty({
    enum: Gender,
    example: Gender.FEMALE,
    description: 'Género del paciente',
  })
  @IsEnum(Gender, { message: i18nValidationMessage('validation.gender') })
  gender: Gender;

  @ApiPropertyOptional({
    example: 'Av. Principal 123',
    description: 'Dirección',
  })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  address: string;

  @ApiPropertyOptional({
    example: 'Arquitecto',
    description: 'Profesión del paciente',
  })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @MaxLength(120, { message: i18nValidationMessage('validation.maxLength') })
  @IsOptional()
  profession?: string;

  @ApiPropertyOptional({
    example: 'Av. Principal',
    description: 'Calle de la dirección del paciente',
  })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @MaxLength(180, { message: i18nValidationMessage('validation.maxLength') })
  @IsOptional()
  streetAddress?: string;

  @ApiPropertyOptional({
    example: '1234',
    description: 'Número de puerta o domicilio',
  })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @MaxLength(40, { message: i18nValidationMessage('validation.maxLength') })
  @IsOptional()
  addressNumber?: string;

  @ApiPropertyOptional({
    example: 'Pocitos',
    description: 'Barrio del paciente',
  })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @MaxLength(120, { message: i18nValidationMessage('validation.maxLength') })
  @IsOptional()
  neighborhood?: string;

  @ApiPropertyOptional({
    example: 'Montevideo',
    description: 'Localidad o ciudad del paciente',
  })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @MaxLength(120, { message: i18nValidationMessage('validation.maxLength') })
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({
    example: '11300',
    description: 'Código postal del paciente',
  })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @MaxLength(40, { message: i18nValidationMessage('validation.maxLength') })
  @IsOptional()
  postalCode?: string;

  @ApiPropertyOptional({
    example: '+5491112345678',
    description: 'Teléfono',
  })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  phone: string;

  @ApiPropertyOptional({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description:
      'UUID del archivo usado como foto de perfil. Se administra con el endpoint de foto.',
  })
  @IsUUID(undefined, { message: i18nValidationMessage('validation.isUUID') })
  @IsOptional()
  profilePhotoFileId?: string;

  @ApiPropertyOptional({
    example: 'https://example.com/uploads/patient-files/foto.jpg',
    description:
      'URL de la foto de perfil. Se administra con el endpoint de foto.',
  })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  profilePhotoUrl?: string;

  @ApiPropertyOptional({
    example: 'Laura López +59891111111',
    description: 'Contacto de emergencia',
  })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  emergencyContact?: string;

  @ApiPropertyOptional({
    example: 'Prefiere turnos por la mañana',
    description: 'Observaciones generales',
  })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  observations?: string;

  @ApiPropertyOptional({
    example: 'Hipertensión controlada',
    description: 'Antecedentes médicos básicos',
  })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  medicalHistory?: string;

  @ApiPropertyOptional({
    example: 'Bruxismo nocturno',
    description: 'Antecedentes odontológicos básicos',
  })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  dentalHistory?: string;
}
