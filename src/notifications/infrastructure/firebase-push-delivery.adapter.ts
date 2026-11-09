import { Injectable } from '@nestjs/common';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import type { Messaging } from 'firebase-admin/messaging';
import { getMessaging } from 'firebase-admin/messaging';

import type {
  NotificationRecord,
  PushDeliveryPort,
  PushDeliveryResult,
  PushDeviceRegistration,
} from '../application/notifications.port';

const invalidRegistrationCodes = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);
const multicastLimit = 500;

@Injectable()
export class FirebasePushDeliveryAdapter implements PushDeliveryPort {
  private messagingClient: Messaging | undefined;

  async send(
    devices: PushDeviceRegistration[],
    notification: NotificationRecord,
  ): Promise<PushDeliveryResult> {
    let acceptedCount = 0;
    let failedCount = 0;
    const invalidTokens: string[] = [];

    for (let start = 0; start < devices.length; start += multicastLimit) {
      const batch = devices.slice(start, start + multicastLimit);
      const response = await this.messaging().sendEachForMulticast({
        tokens: batch.map((device) => device.token),
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: this.messageData(notification),
        android: {
          priority: 'high',
          notification: { channelId: 'dentalhub_high_importance' },
        },
      });

      response.responses.forEach((result, index) => {
        if (result.success) {
          acceptedCount++;

          return;
        }

        failedCount++;
        const code = result.error?.code;

        if (code && invalidRegistrationCodes.has(code)) {
          invalidTokens.push(batch[index].token);
        }
      });
    }

    return { acceptedCount, failedCount, invalidTokens };
  }

  private messaging(): Messaging {
    if (this.messagingClient) return this.messagingClient;

    const app =
      getApps()[0] ?? initializeApp({ credential: applicationDefault() });

    this.messagingClient = getMessaging(app);

    return this.messagingClient;
  }

  private messageData(
    notification: NotificationRecord,
  ): Record<string, string> {
    const data: Record<string, string> = {
      title: notification.title,
      body: notification.body,
    };

    for (const [key, value] of Object.entries(notification.data)) {
      if (value === null || value === undefined) continue;

      data[key] = this.serializeDataValue(value);
    }

    data.notificationId = notification.id;

    return data;
  }

  private serializeDataValue(value: unknown): string {
    if (typeof value === 'string') return value;

    const serialized = JSON.stringify(value);

    if (serialized === undefined) {
      throw new TypeError('Notification data must be JSON serializable.');
    }

    return serialized;
  }
}
