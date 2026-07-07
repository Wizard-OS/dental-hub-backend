import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
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
  @IsString()
  name: string;

  @ApiProperty({
    example: 30,
    description: 'Duración en minutos (mín. 5)',
    minimum: 5,
  })
  @IsInt()
  @Min(5)
  durationMin: number;

  @ApiProperty({
    example: '500.00',
    description: 'Precio por defecto (decimal string)',
  })
  @Matches(/^\d+(\.\d{1,2})?$/)
  defaultPrice: string;

  @ApiPropertyOptional({ example: '#3498db', description: 'Color en hex' })
  @IsString()
  @IsOptional()
  color?: string;

  @ApiPropertyOptional({ example: true, description: '¿Activo?' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
