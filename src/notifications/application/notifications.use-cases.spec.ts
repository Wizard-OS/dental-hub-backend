import type {
  NewNotification,
  NotificationRecord,
  NotificationsRepositoryPort,
  PushDeliveryPort,
  PushDeliveryResult,
  PushDeviceRegistration,
} from './notifications.port';
import {
  MarkNotificationReadUseCase,
  NoRegisteredPushDevicesError,
  RegisterPushDeviceUseCase,
  SendPushNotificationUseCase,
  UnregisterPushDeviceUseCase,
} from './notifications.use-cases';

describe('notification use cases', () => {
  it('registers and unregisters device tokens for the authenticated user', async () => {
    const repository = new FakeNotificationsRepository();

    await new RegisterPushDeviceUseCase(repository).execute(
      'user-1',
      'fcm-token',
      'android',
    );
    await new UnregisterPushDeviceUseCase(repository).execute(
      'user-1',
      'fcm-token',
    );

    expect(repository.registeredDevices).toEqual([
      { userId: 'user-1', token: 'fcm-token', platform: 'android' },
    ]);
    expect(repository.removedDevices).toEqual([
      { userId: 'user-1', token: 'fcm-token' },
    ]);
  });

  it('scopes read updates to the requested user', async () => {
    const repository = new FakeNotificationsRepository();
    const markRead = new MarkNotificationReadUseCase(repository);

    await expect(markRead.execute('user-2', 'notification-1')).resolves.toBe(
      false,
    );
    expect(repository.readRequests).toEqual([
      { userId: 'user-2', notificationId: 'notification-1' },
    ]);
  });

  it('persists before sending and removes invalid device tokens', async () => {
    const repository = new FakeNotificationsRepository();
    const delivery = new FakePushDelivery({
      acceptedCount: 1,
      failedCount: 1,
      invalidTokens: ['expired-token'],
    });
    const send = new SendPushNotificationUseCase(repository, delivery);
    const input: NewNotification = {
      userId: 'user-1',
      title: 'DentalHub test notification',
      body: 'This is an end-to-end push delivery check.',
      data: { category: 'system', source: 'smoke-test' },
    };

    const result = await send.execute(input);

    expect(repository.createdNotifications).toEqual([input]);
    expect(delivery.sentNotifications).toHaveLength(1);
    expect(delivery.sentNotifications[0].id).toBe('notification-1');
    expect(result).toEqual({
      notificationId: 'notification-1',
      acceptedCount: 1,
      failedCount: 1,
    });
    expect(repository.removedInvalidDevices).toEqual([
      { userId: 'user-1', tokens: ['expired-token'] },
    ]);
  });

  it('does not persist when the user has no registered devices', async () => {
    const repository = new FakeNotificationsRepository();

    repository.devices = [];

    const send = new SendPushNotificationUseCase(
      repository,
      new FakePushDelivery({
        acceptedCount: 0,
        failedCount: 0,
        invalidTokens: [],
      }),
    );

    await expect(
      send.execute({
        userId: 'user-1',
        title: 'Test',
        body: 'Body',
        data: {},
      }),
    ).rejects.toBeInstanceOf(NoRegisteredPushDevicesError);
    expect(repository.createdNotifications).toHaveLength(0);
  });
});

class FakeNotificationsRepository implements NotificationsRepositoryPort {
  readonly registeredDevices: Array<{
    userId: string;
    token: string;
    platform: string;
  }> = [];
  readonly removedDevices: Array<{ userId: string; token: string }> = [];
  readonly removedInvalidDevices: Array<{ userId: string; tokens: string[] }> =
    [];
  readonly createdNotifications: NewNotification[] = [];
  readonly readRequests: Array<{ userId: string; notificationId: string }> = [];
  devices: PushDeviceRegistration[] = [
    { token: 'active-token', platform: 'android' },
    { token: 'expired-token', platform: 'android' },
  ];

  registerPushDevice(
    userId: string,
    registration: PushDeviceRegistration,
  ): Promise<void> {
    this.registeredDevices.push({ userId, ...registration });

    return Promise.resolve();
  }

  removePushDevice(userId: string, token: string): Promise<void> {
    this.removedDevices.push({ userId, token });

    return Promise.resolve();
  }

  findPushDevices(): Promise<PushDeviceRegistration[]> {
    return Promise.resolve(this.devices);
  }

  removeInvalidPushDevices(userId: string, tokens: string[]): Promise<void> {
    this.removedInvalidDevices.push({ userId, tokens });

    return Promise.resolve();
  }

  createNotification(
    notification: NewNotification,
  ): Promise<NotificationRecord> {
    this.createdNotifications.push(notification);

    return Promise.resolve({
      id: 'notification-1',
      ...notification,
      isRead: false,
      isDismissed: false,
      createdAt: new Date('2026-11-08T00:00:00.000Z'),
    });
  }

  findNotifications(): Promise<NotificationRecord[]> {
    return Promise.resolve([]);
  }

  markNotificationRead(
    userId: string,
    notificationId: string,
  ): Promise<boolean> {
    this.readRequests.push({ userId, notificationId });

    return Promise.resolve(
      userId === 'user-1' && notificationId === 'notification-1',
    );
  }

  markAllNotificationsRead(): Promise<void> {
    return Promise.resolve();
  }

  dismissNotification(
    userId: string,
    notificationId: string,
  ): Promise<boolean> {
    return Promise.resolve(
      userId === 'user-1' && notificationId === 'notification-1',
    );
  }
}

class FakePushDelivery implements PushDeliveryPort {
  readonly sentNotifications: NotificationRecord[] = [];

  constructor(private readonly result: PushDeliveryResult) {}

  send(
    _devices: PushDeviceRegistration[],
    notification: NotificationRecord,
  ): Promise<PushDeliveryResult> {
    this.sentNotifications.push(notification);

    return Promise.resolve(this.result);
  }
}
