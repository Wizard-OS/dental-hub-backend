import { i18nValidationMessage } from 'nestjs-i18n';
import { IsEnum, IsObject, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { ClinicMembershipRole } from '../interfaces/clinic-membership-role.enum';

export class CreateClinicMembershipDto {
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'UUID de la clínica',
  })
  @IsUUID(undefined, { message: i18nValidationMessage('validation.isUUID') })
  clinicId: string;

  @ApiProperty({
    example: 'f1e2d3c4-b5a6-7890-abcd-ef1234567890',
    description: 'UUID del usuario',
  })
  @IsUUID(undefined, { message: i18nValidationMessage('validation.isUUID') })
  userId: string;

  @ApiProperty({
    enum: ClinicMembershipRole,
    example: ClinicMembershipRole.odontologist,
    description: 'Rol en la clínica',
  })
  @IsEnum(ClinicMembershipRole, {
    message: i18nValidationMessage('validation.isEnum'),
  })
  role: ClinicMembershipRole;

  @ApiPropertyOptional({
    example: {
      canManagePatients: true,
      canViewPatientContact: true,
      canManageClinical: true,
      canManageSchedule: true,
    },
    description: 'Permisos granulares personalizados en JSON',
  })
  @IsObject({ message: i18nValidationMessage('validation.isObject') })
  @IsOptional()
  permissionsJson?: Record<string, boolean>;
}
