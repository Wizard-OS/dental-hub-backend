import { i18nValidationMessage } from 'nestjs-i18n';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TreatmentStatus } from '../interfaces/treatment-status.enum';

export class CreateTreatmentDto {
  @ApiProperty({ example: 'Ortodoncia', description: 'Nombre del tratamiento' })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  name: string;

  @ApiProperty({ description: 'UUID del paciente' })
  @IsUUID(undefined, { message: i18nValidationMessage('validation.isUUID') })
  patientId: string;

  @ApiProperty({ description: 'UUID del doctor' })
  @IsUUID(undefined, { message: i18nValidationMessage('validation.isUUID') })
  doctorId: string;

  @ApiPropertyOptional({
    description: 'UUID de la membresía del profesional responsable',
  })
  @IsUUID(undefined, { message: i18nValidationMessage('validation.isUUID') })
  @IsOptional()
  professionalMembershipId?: string;

  @ApiPropertyOptional({ example: '36', description: 'Pieza dental opcional' })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  toothCode?: string;

  @ApiPropertyOptional({
    example: 'Tratamiento de brackets metálicos',
    description: 'Descripción',
  })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  description?: string;

  @ApiProperty({
    example: '15000.00',
    description: 'Precio base (decimal string)',
  })
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: i18nValidationMessage('validation.matches'),
  })
  basePrice: string;

  @ApiPropertyOptional({
    enum: TreatmentStatus,
    example: TreatmentStatus.PROPOSED,
    description: 'Estado del plan de tratamiento',
  })
  @IsEnum(TreatmentStatus, {
    message: i18nValidationMessage('validation.isEnum'),
  })
  @IsOptional()
  status?: TreatmentStatus;

  @ApiPropertyOptional({
    description: 'UUID del presupuesto/factura relacionado',
  })
  @IsUUID(undefined, { message: i18nValidationMessage('validation.isUUID') })
  @IsOptional()
  invoiceId?: string;

  @ApiPropertyOptional({ example: true, description: '¿Activo?' })
  @IsBoolean({ message: i18nValidationMessage('validation.isBoolean') })
  @IsOptional()
  isActive?: boolean;
}
