import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { ExpenseCategory } from '../interfaces/expense-category.enum';

export class CreateExpenseDto {
  @ApiPropertyOptional({
    description:
      'UUID de la clínica. Opcional/deprecado en endpoints con x-clinic-id.',
  })
  @IsUUID()
  @IsOptional()
  clinicId?: string;

  @ApiProperty({
    enum: ExpenseCategory,
    example: ExpenseCategory.SUPPLIES,
    description: 'Categoría del gasto',
  })
  @IsEnum(ExpenseCategory)
  category: ExpenseCategory;

  @ApiProperty({ example: '250.00', description: 'Monto (decimal string)' })
  @Matches(/^\d+(\.\d{1,2})?$/)
  amount: string;

  @ApiProperty({
    example: '2026-04-10',
    description: 'Fecha del gasto (ISO 8601)',
  })
  @IsDateString()
  spentAt: Date;

  @ApiPropertyOptional({
    example: 'Material de limpieza',
    description: 'Notas',
  })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({
    description: 'UUID de la membresía que registró el gasto',
  })
  @IsUUID()
  @IsOptional()
  recordedByMembershipId?: string;
}
