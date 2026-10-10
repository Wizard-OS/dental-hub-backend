import { i18nValidationMessage } from 'nestjs-i18n';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

import { MembershipPlanCode } from '../../membership/interfaces/membership-plan-code.enum';

export class UpdateBackofficeSubscriptionDto {
  @ApiProperty({
    enum: MembershipPlanCode,
    example: MembershipPlanCode.premium,
    description: 'Plan comercial a asignar desde backoffice',
  })
  @IsEnum(MembershipPlanCode, {
    message: i18nValidationMessage('validation.isEnum'),
  })
  planCode: MembershipPlanCode;

  @ApiPropertyOptional({
    example: 'Upgrade manual solicitado por comercial',
    description: 'Motivo auditable del cambio',
  })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @MaxLength(500, { message: i18nValidationMessage('validation.maxLength') })
  @IsOptional()
  reason?: string;
}
