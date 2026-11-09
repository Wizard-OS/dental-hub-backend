import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import type { NotificationsRepositoryPort } from './application/notifications.port';
import {
  NOTIFICATIONS_REPOSITORY,
  PUSH_DELIVERY,
} from './application/notifications.port';
import {
  DismissNotificationUseCase,
  FindNotificationsUseCase,
  MarkAllNotificationsReadUseCase,
  MarkNotificationReadUseCase,
  RegisterPushDeviceUseCase,
  SendPushNotificationUseCase,
  UnregisterPushDeviceUseCase,
} from './application/notifications.use-cases';
import { PushDevice } from './entities/push-device.entity';
import { UserNotification } from './entities/user-notification.entity';
import { FirebasePushDeliveryAdapter } from './infrastructure/firebase-push-delivery.adapter';
import { TypeOrmNotificationsRepository } from './infrastructure/typeorm-notifications.repository';
import { NotificationsController } from './presentation/notifications.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PushDevice, UserNotification])],
  controllers: [NotificationsController],
  providers: [
    TypeOrmNotificationsRepository,
    {
      provide: NOTIFICATIONS_REPOSITORY,
      useExisting: TypeOrmNotificationsRepository,
    },
    FirebasePushDeliveryAdapter,
    {
      provide: PUSH_DELIVERY,
      useExisting: FirebasePushDeliveryAdapter,
    },
    {
      provide: RegisterPushDeviceUseCase,
      useFactory: (repository: NotificationsRepositoryPort) =>
        new RegisterPushDeviceUseCase(repository),
      inject: [NOTIFICATIONS_REPOSITORY],
    },
    {
      provide: UnregisterPushDeviceUseCase,
      useFactory: (repository: NotificationsRepositoryPort) =>
        new UnregisterPushDeviceUseCase(repository),
      inject: [NOTIFICATIONS_REPOSITORY],
    },
    {
      provide: FindNotificationsUseCase,
      useFactory: (repository: NotificationsRepositoryPort) =>
        new FindNotificationsUseCase(repository),
      inject: [NOTIFICATIONS_REPOSITORY],
    },
    {
      provide: MarkNotificationReadUseCase,
      useFactory: (repository: NotificationsRepositoryPort) =>
        new MarkNotificationReadUseCase(repository),
      inject: [NOTIFICATIONS_REPOSITORY],
    },
    {
      provide: MarkAllNotificationsReadUseCase,
      useFactory: (repository: NotificationsRepositoryPort) =>
        new MarkAllNotificationsReadUseCase(repository),
      inject: [NOTIFICATIONS_REPOSITORY],
    },
    {
      provide: DismissNotificationUseCase,
      useFactory: (repository: NotificationsRepositoryPort) =>
        new DismissNotificationUseCase(repository),
      inject: [NOTIFICATIONS_REPOSITORY],
    },
    {
      provide: SendPushNotificationUseCase,
      useFactory: (
        repository: NotificationsRepositoryPort,
        delivery: FirebasePushDeliveryAdapter,
      ) => new SendPushNotificationUseCase(repository, delivery),
      inject: [NOTIFICATIONS_REPOSITORY, PUSH_DELIVERY],
    },
  ],
  exports: [SendPushNotificationUseCase],
})
export class NotificationsModule {}
