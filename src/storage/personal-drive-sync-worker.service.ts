import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';

import { getEnv } from '../config/env';
import { PersonalDrive } from './application/personal-drive';

@Injectable()
export class PersonalDriveSyncWorker
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private timer?: NodeJS.Timeout;
  private active?: Promise<void>;
  private readonly logger = new Logger(PersonalDriveSyncWorker.name);

  constructor(private readonly drive: PersonalDrive) {}

  onApplicationBootstrap() {
    if (
      getEnv('GOOGLE_DRIVE_SYNC_WORKER_ENABLED') === 'false' ||
      getEnv('NODE_ENV') === 'test'
    )
      return;

    this.timer = setInterval(() => void this.runOnce(), 5 * 60 * 1000);
    this.timer.unref();
    void this.runOnce();
  }

  async onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
    await this.active;
  }

  runOnce() {
    if (this.active) return this.active;
    this.active = this.drive
      .syncConnectedIntegrations()
      .catch(() => {
        this.logger.warn('Drive sync failed; the next worker run will retry');
      })
      .finally(() => {
        this.active = undefined;
      });
    return this.active;
  }
}
