import type {
  NewNotification,
  NotificationsRepositoryPort,
  PushDeliveryPort,
  PushPlatform,
} from './notifications.port';

export class NoRegisteredPushDevicesError extends Error {
  constructor() {
    super('No push-enabled devices are registered for this user.');
    this.name = 'NoRegisteredPushDevicesError';
  }
}

export class RegisterPushDeviceUseCase {
  constructor(private readonly repository: NotificationsRepositoryPort) {}

  execute(
    userId: string,
    token: string,
    platform: PushPlatform,
  ): Promise<void> {
    return this.repository.registerPushDevice(userId, { token, platform });
  }
}

export class UnregisterPushDeviceUseCase {
  constructor(private readonly repository: NotificationsRepositoryPort) {}

  execute(userId: string, token: string): Promise<void> {
    return this.repository.removePushDevice(userId, token);
  }
}

export class FindNotificationsUseCase {
  constructor(private readonly repository: NotificationsRepositoryPort) {}

  execute(userId: string) {
    return this.repository.findNotifications(userId);
  }
}

export class MarkNotificationReadUseCase {
  constructor(private readonly repository: NotificationsRepositoryPort) {}

  execute(userId: string, notificationId: string): Promise<boolean> {
    return this.repository.markNotificationRead(userId, notificationId);
  }
}

export class MarkAllNotificationsReadUseCase {
  constructor(private readonly repository: NotificationsRepositoryPort) {}

  execute(userId: string): Promise<void> {
    return this.repository.markAllNotificationsRead(userId);
  }
}

export class DismissNotificationUseCase {
  constructor(private readonly repository: NotificationsRepositoryPort) {}

  execute(userId: string, notificationId: string): Promise<boolean> {
    return this.repository.dismissNotification(userId, notificationId);
  }
}

export class SendPushNotificationUseCase {
  constructor(
    private readonly repository: NotificationsRepositoryPort,
    private readonly delivery: PushDeliveryPort,
  ) {}

  async execute(notification: NewNotification) {
    const devices = await this.repository.findPushDevices(notification.userId);

    if (devices.length === 0) throw new NoRegisteredPushDevicesError();

    const saved = await this.repository.createNotification(notification);
    const result = await this.delivery.send(devices, saved);

    if (result.invalidTokens.length > 0) {
      await this.repository.removeInvalidPushDevices(
        notification.userId,
        result.invalidTokens,
      );
    }

    return {
      notificationId: saved.id,
      acceptedCount: result.acceptedCount,
      failedCount: result.failedCount,
    };
  }
}
