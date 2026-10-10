import { i18nValidationMessage } from 'nestjs-i18n';
import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

import { CreateClinicMembershipDto } from './create-clinic-membership.dto';

export class UpdateClinicMembershipDto extends PartialType(
  CreateClinicMembershipDto,
) {
  @IsBoolean({ message: i18nValidationMessage('validation.isBoolean') })
  @IsOptional()
  isActive?: boolean;
}
