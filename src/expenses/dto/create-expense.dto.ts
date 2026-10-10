import { i18nValidationMessage } from 'nestjs-i18n';
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
  @IsUUID(undefined, { message: i18nValidationMessage('validation.isUUID') })
  @IsOptional()
  clinicId?: string;

  @ApiProperty({
    enum: ExpenseCategory,
    example: ExpenseCategory.SUPPLIES,
    description: 'Categoría del gasto',
  })
  @IsEnum(ExpenseCategory, {
    message: i18nValidationMessage('validation.isEnum'),
  })
  category: ExpenseCategory;

  @ApiProperty({ example: '250.00', description: 'Monto (decimal string)' })
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: i18nValidationMessage('validation.matches'),
  })
  amount: string;

  @ApiProperty({
    example: '2026-04-10',
    description: 'Fecha del gasto (ISO 8601)',
  })
  @IsDateString(
    {},
    { message: i18nValidationMessage('validation.isDateString') },
  )
  spentAt: Date;

  @ApiPropertyOptional({
    example: 'Material de limpieza',
    description: 'Notas',
  })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({
    description: 'UUID de la membresía que registró el gasto',
  })
  @IsUUID(undefined, { message: i18nValidationMessage('validation.isUUID') })
  @IsOptional()
  recordedByMembershipId?: string;
}
