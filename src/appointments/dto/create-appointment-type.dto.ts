import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAppointmentTypeDto {
  @ApiPropertyOptional({
    description:
      'UUID de la clínica. Opcional/deprecado en endpoints con x-clinic-id.',
  })
  @IsUUID()
  @IsOptional()
  clinicId?: string;

  @ApiProperty({ example: 'Limpieza', description: 'Nombre del tipo de cita' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(/\S/)
  @MaxLength(120)
  name: string;

  @ApiProperty({
    example: 30,
    description: 'Duración en minutos (mín. 5)',
    minimum: 5,
  })
  @IsInt()
  @Min(5)
  durationMin: number;

  @ApiPropertyOptional({
    nullable: true,
    example: '500.00',
    description: 'Precio por defecto (decimal string)',
  })
  @IsOptional()
  @Matches(/^\d{1,10}(\.\d{1,2})?$/)
  defaultPrice?: string | null;

  @ApiPropertyOptional({ example: '#3498db', description: 'Color en hex' })
  @ValidateIf((_, value) => value !== undefined)
  @Matches(/^#[0-9a-fA-F]{6}$/)
  color?: string;

  @ApiPropertyOptional({ example: 'UYU', default: 'UYU' })
  @ValidateIf((_, value) => value !== undefined)
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @ApiPropertyOptional({ example: true, description: '¿Activo?' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
