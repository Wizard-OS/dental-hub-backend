import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import type {
  NewNotification,
  NotificationsRepositoryPort,
  PushDeviceRegistration,
} from '../application/notifications.port';
import { PushDevice } from '../entities/push-device.entity';
import { UserNotification } from '../entities/user-notification.entity';

@Injectable()
export class TypeOrmNotificationsRepository implements NotificationsRepositoryPort {
  constructor(
    @InjectRepository(PushDevice)
    private readonly pushDeviceRepository: Repository<PushDevice>,
    @InjectRepository(UserNotification)
    private readonly notificationRepository: Repository<UserNotification>,
  ) {}

  async registerPushDevice(
    userId: string,
    registration: PushDeviceRegistration,
  ): Promise<void> {
    await this.pushDeviceRepository.upsert(
      {
        userId,
        token: registration.token,
        platform: registration.platform,
      },
      ['token'],
    );
  }

  async removePushDevice(userId: string, token: string): Promise<void> {
    await this.pushDeviceRepository.delete({ userId, token });
  }

  findPushDevices(userId: string): Promise<PushDeviceRegistration[]> {
    return this.pushDeviceRepository.find({
      select: { token: true, platform: true },
      where: { userId },
    });
  }

  async removeInvalidPushDevices(
    userId: string,
    tokens: string[],
  ): Promise<void> {
    if (tokens.length === 0) return;

    await this.pushDeviceRepository.delete({
      userId,
      token: In(tokens),
    });
  }

  createNotification(notification: NewNotification): Promise<UserNotification> {
    return this.notificationRepository.save(
      this.notificationRepository.create(notification),
    );
  }

  findNotifications(userId: string): Promise<UserNotification[]> {
    return this.notificationRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async markNotificationRead(
    userId: string,
    notificationId: string,
  ): Promise<boolean> {
    const result = await this.notificationRepository.update(
      { userId, id: notificationId },
      { isRead: true },
    );

    return (result.affected ?? 0) > 0;
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    await this.notificationRepository.update(
      { userId, isRead: false },
      { isRead: true },
    );
  }

  async dismissNotification(
    userId: string,
    notificationId: string,
  ): Promise<boolean> {
    const result = await this.notificationRepository.update(
      { userId, id: notificationId },
      { isDismissed: true },
    );

    return (result.affected ?? 0) > 0;
  }
}
