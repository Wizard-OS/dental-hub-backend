import { NestFactory } from '@nestjs/core';

import { AppModule } from '../../app.module';
import {
  NoRegisteredPushDevicesError,
  SendPushNotificationUseCase,
} from '../application/notifications.use-cases';

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'The notification smoke command only runs outside production.',
    );
  }

  const userId = readUserId(process.argv.slice(2));
  const application = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const sendNotification = application.get(SendPushNotificationUseCase);
    const result = await sendNotification.execute({
      userId,
      title: 'DentalHub test notification',
      body: 'This is an end-to-end push delivery check.',
      data: { category: 'system', source: 'smoke-test' },
    });

    console.log(
      'Notification ' +
        result.notificationId +
        ': FCM accepted ' +
        result.acceptedCount +
        ', failed ' +
        result.failedCount +
        '.',
    );

    if (result.acceptedCount === 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    if (error instanceof NoRegisteredPushDevicesError) {
      console.error(error.message);
      process.exitCode = 1;
    } else {
      throw error;
    }
  } finally {
    await application.close();
  }
}

function readUserId(args: string[]): string {
  const index = args.indexOf('--user-id');
  const userId = index >= 0 ? args[index + 1] : undefined;

  if (!userId) {
    throw new Error(
      'Usage: pnpm notifications:smoke -- --user-id <non-production-user-id>',
    );
  }

  return userId;
}

void main().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? error.message
      : 'Notification smoke command failed.',
  );
  process.exitCode = 1;
});
