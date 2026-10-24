import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { NotificationPreference } from './entities/notification-preference.entity';

@Injectable()
export class NotificationPreferencesService {
  constructor(
    @InjectRepository(NotificationPreference)
    private readonly prefRepository: Repository<NotificationPreference>,
  ) {}

  async getByUser(userId: string): Promise<NotificationPreference> {
    let prefs = await this.prefRepository.findOne({ where: { userId } });

    if (!prefs) {
      prefs = this.prefRepository.create({ userId });
      await this.prefRepository.save(prefs);
    }

    return prefs;
  }

  async update(
    userId: string,
    dto: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreference> {
    let prefs = await this.prefRepository.findOne({ where: { userId } });

    if (!prefs) {
      prefs = this.prefRepository.create({ userId, ...dto });
    } else {
      Object.assign(prefs, dto);
    }

    return await this.prefRepository.save(prefs);
  }
}
