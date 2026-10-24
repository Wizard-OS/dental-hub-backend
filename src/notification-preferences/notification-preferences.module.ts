import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { NotificationPreference } from './entities/notification-preference.entity';
import { NotificationPreferencesController } from './notification-preferences.controller';
import { NotificationPreferencesService } from './notification-preferences.service';

@Module({
  controllers: [NotificationPreferencesController],
  providers: [NotificationPreferencesService],
  imports: [TypeOrmModule.forFeature([NotificationPreference])],
  exports: [TypeOrmModule, NotificationPreferencesService],
})
export class NotificationPreferencesModule {}
