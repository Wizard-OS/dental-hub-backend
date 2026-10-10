import { i18nValidationMessage } from 'nestjs-i18n';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

import { MembershipPlanCode } from '../interfaces/membership-plan-code.enum';

export class UpdateMembershipPlanDto {
  @ApiProperty({
    enum: MembershipPlanCode,
    example: MembershipPlanCode.premium,
    description: 'Plan comercial a asignar manualmente',
  })
  @IsEnum(MembershipPlanCode, {
    message: i18nValidationMessage('validation.isEnum'),
  })
  planCode: MembershipPlanCode;

  @ApiPropertyOptional({
    example: 'Upgrade manual MVP',
    description: 'Motivo auditable del cambio manual',
  })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @MaxLength(500, { message: i18nValidationMessage('validation.maxLength') })
  @IsOptional()
  reason?: string;
}
