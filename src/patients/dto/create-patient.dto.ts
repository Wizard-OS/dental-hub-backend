import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Gender } from '../../common/interfaces/gender.enum';

export class CreatePatientDto {
  @ApiPropertyOptional({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description:
      'UUID de la clínica. Opcional/deprecado en endpoints con x-clinic-id.',
  })
  @IsUUID()
  @IsOptional()
  clinicId?: string;

  @ApiPropertyOptional({
    example: 'paciente@email.com',
    description: 'Email del paciente',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: 'María', description: 'Nombre del paciente' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'López', description: 'Apellido del paciente' })
  @IsString()
  lastName: string;

  @ApiProperty({
    example: '1990-05-15',
    description: 'Fecha de nacimiento (ISO 8601)',
  })
  @IsDateString()
  birthDate: Date;

  @ApiProperty({
    enum: Gender,
    example: Gender.FEMALE,
    description: 'Género del paciente',
  })
  @IsEnum(Gender, {
    message: 'gender must be a valid enum value',
  })
  gender: Gender;

  @ApiPropertyOptional({
    example: 'Av. Principal 123',
    description: 'Dirección',
  })
  @IsString()
  @IsOptional()
  address: string;

  @ApiPropertyOptional({
    example: '+5491112345678',
    description: 'Teléfono',
  })
  @IsString()
  @IsOptional()
  phone: string;
}
