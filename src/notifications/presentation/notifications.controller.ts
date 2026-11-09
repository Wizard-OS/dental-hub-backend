import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Put,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { Auth, GetUser } from '../../auth/decorators';
import {
  DismissNotificationUseCase,
  FindNotificationsUseCase,
  MarkAllNotificationsReadUseCase,
  MarkNotificationReadUseCase,
  RegisterPushDeviceUseCase,
  UnregisterPushDeviceUseCase,
} from '../application/notifications.use-cases';
import { PushDeviceDto, UnregisterPushDeviceDto } from './dto/push-device.dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller()
@Auth()
export class NotificationsController {
  constructor(
    private readonly registerPushDevice: RegisterPushDeviceUseCase,
    private readonly unregisterPushDevice: UnregisterPushDeviceUseCase,
    private readonly findNotifications: FindNotificationsUseCase,
    private readonly markNotificationRead: MarkNotificationReadUseCase,
    private readonly markAllNotificationsRead: MarkAllNotificationsReadUseCase,
    private readonly dismissNotification: DismissNotificationUseCase,
  ) {}

  @Put('push-devices')
  @ApiOperation({ summary: 'Register or update this device push token' })
  @ApiResponse({ status: 200, description: 'Push device registered' })
  registerDevice(
    @GetUser('id') userId: string,
    @Body() dto: PushDeviceDto,
  ): Promise<void> {
    return this.registerPushDevice.execute(userId, dto.token, dto.platform);
  }

  @Delete('push-devices')
  @ApiOperation({ summary: 'Unregister this device push token' })
  @ApiResponse({ status: 200, description: 'Push device unregistered' })
  unregisterDevice(
    @GetUser('id') userId: string,
    @Body() dto: UnregisterPushDeviceDto,
  ): Promise<void> {
    return this.unregisterPushDevice.execute(userId, dto.token);
  }

  @Get('notifications')
  @ApiOperation({ summary: 'List notifications for the authenticated user' })
  @ApiResponse({ status: 200, description: 'User notification inbox' })
  listNotifications(@GetUser('id') userId: string) {
    return this.findNotifications.execute(userId);
  }

  @Patch('notifications/:id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiResponse({ status: 200, description: 'Notification updated' })
  async markRead(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) notificationId: string,
  ): Promise<void> {
    const updated = await this.markNotificationRead.execute(
      userId,
      notificationId,
    );

    if (!updated) throw new NotFoundException('Notification not found.');
  }

  @Patch('notifications/read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({ status: 200, description: 'Notifications updated' })
  markAllRead(@GetUser('id') userId: string): Promise<void> {
    return this.markAllNotificationsRead.execute(userId);
  }

  @Patch('notifications/:id/dismiss')
  @ApiOperation({ summary: 'Dismiss a notification' })
  @ApiResponse({ status: 200, description: 'Notification updated' })
  async dismiss(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) notificationId: string,
  ): Promise<void> {
    const updated = await this.dismissNotification.execute(
      userId,
      notificationId,
    );

    if (!updated) throw new NotFoundException('Notification not found.');
  }
}
