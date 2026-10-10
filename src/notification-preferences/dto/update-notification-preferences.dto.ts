import { i18nValidationMessage } from 'nestjs-i18n';
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateNotificationPreferencesDto {
  @ApiPropertyOptional({
    example: true,
    description: 'Notificaciones por email',
  })
  @IsOptional()
  @IsBoolean({ message: i18nValidationMessage('validation.isBoolean') })
  emailNotifications?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Notificaciones por SMS',
  })
  @IsOptional()
  @IsBoolean({ message: i18nValidationMessage('validation.isBoolean') })
  smsNotifications?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Notificaciones push' })
  @IsOptional()
  @IsBoolean({ message: i18nValidationMessage('validation.isBoolean') })
  pushNotifications?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Recordatorios de citas' })
  @IsOptional()
  @IsBoolean({ message: i18nValidationMessage('validation.isBoolean') })
  appointmentReminders?: boolean;

  @ApiPropertyOptional({ example: false, description: 'Emails de marketing' })
  @IsOptional()
  @IsBoolean({ message: i18nValidationMessage('validation.isBoolean') })
  marketingEmails?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Actualizaciones de tratamiento',
  })
  @IsOptional()
  @IsBoolean({ message: i18nValidationMessage('validation.isBoolean') })
  treatmentUpdates?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Alertas de facturación' })
  @IsOptional()
  @IsBoolean({ message: i18nValidationMessage('validation.isBoolean') })
  billingAlerts?: boolean;
}
