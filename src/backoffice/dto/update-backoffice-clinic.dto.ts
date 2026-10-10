import { i18nValidationMessage } from 'nestjs-i18n';
import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

import { CreateClinicDto } from '../../clinics/dto/create-clinic.dto';

export class UpdateBackofficeClinicDto extends PartialType(CreateClinicDto) {
  @ApiPropertyOptional({
    example: true,
    description: 'Estado administrativo de la clínica',
  })
  @IsBoolean({ message: i18nValidationMessage('validation.isBoolean') })
  @IsOptional()
  isActive?: boolean;
}
