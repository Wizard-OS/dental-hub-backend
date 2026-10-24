import { Body, Controller, Get, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { Auth, GetUser } from '../auth/decorators';
import { User } from '../auth/entities/user.entity';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { NotificationPreferencesService } from './notification-preferences.service';

@ApiTags('Notification Preferences')
@ApiBearerAuth()
@Controller('notification-preferences')
@Auth()
export class NotificationPreferencesController {
  constructor(
    private readonly notificationPreferencesService: NotificationPreferencesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Obtener preferencias de notificación' })
  @ApiResponse({ status: 200, description: 'Preferencias del usuario' })
  getPreferences(@GetUser() user: User) {
    return this.notificationPreferencesService.getByUser(user.id);
  }

  @Patch()
  @ApiOperation({ summary: 'Actualizar preferencias de notificación' })
  @ApiResponse({ status: 200, description: 'Preferencias actualizadas' })
  updatePreferences(
    @GetUser() user: User,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.notificationPreferencesService.update(user.id, dto);
  }
}
