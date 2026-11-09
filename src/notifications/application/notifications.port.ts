export type PushPlatform = 'android' | 'ios';

export interface PushDeviceRegistration {
  token: string;
  platform: PushPlatform;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  isRead: boolean;
  isDismissed: boolean;
  createdAt: Date;
}

export interface NewNotification {
  userId: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
}

export interface PushDeliveryResult {
  acceptedCount: number;
  failedCount: number;
  invalidTokens: string[];
}

export interface NotificationsRepositoryPort {
  registerPushDevice(
    userId: string,
    registration: PushDeviceRegistration,
  ): Promise<void>;
  removePushDevice(userId: string, token: string): Promise<void>;
  findPushDevices(userId: string): Promise<PushDeviceRegistration[]>;
  removeInvalidPushDevices(userId: string, tokens: string[]): Promise<void>;
  createNotification(
    notification: NewNotification,
  ): Promise<NotificationRecord>;
  findNotifications(userId: string): Promise<NotificationRecord[]>;
  markNotificationRead(
    userId: string,
    notificationId: string,
  ): Promise<boolean>;
  markAllNotificationsRead(userId: string): Promise<void>;
  dismissNotification(userId: string, notificationId: string): Promise<boolean>;
}

export interface PushDeliveryPort {
  send(
    devices: PushDeviceRegistration[],
    notification: NotificationRecord,
  ): Promise<PushDeliveryResult>;
}

export const NOTIFICATIONS_REPOSITORY = Symbol('NOTIFICATIONS_REPOSITORY');
export const PUSH_DELIVERY = Symbol('PUSH_DELIVERY');
