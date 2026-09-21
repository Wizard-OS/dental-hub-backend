import {
  IsEmail,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Juan', description: 'Nombre' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Pérez', description: 'Apellido' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({
    example: 'new@example.com',
    description: 'Correo electrónico',
  })
  @IsOptional()
  @IsString()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+5491112345678', description: 'Teléfono' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({
    example: '1988-05-12T00:00:00.000Z',
    description: 'Fecha de nacimiento',
  })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional({
    example: 'CJPPU-12345',
    description: 'Número de caja profesional',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  professionalLicenseNumber?: string;

  @ApiPropertyOptional({
    example: '28d89310-5dc9-45ee-9db6-1b1f7b9da44f',
    description: 'Especialidad profesional',
  })
  @IsOptional()
  @IsUUID()
  professionalSpecialtyId?: string;

  @ApiPropertyOptional({ example: '210000000018', description: 'RUT' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  rut?: string;
}
