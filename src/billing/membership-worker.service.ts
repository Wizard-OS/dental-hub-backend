import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { getEnv } from '../config/env';
import { ClinicSubscription } from '../membership/entities/clinic-subscription.entity';
import { BillingService } from './billing.service';
import { MembershipRenewalsService } from './vault/membership-renewals.service';
import { MembershipRemindersService } from './notifications/membership-reminders.service';

@Injectable()
export class MembershipWorker
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private timer?: NodeJS.Timeout;
  private active?: Promise<void>;
  private readonly logger = new Logger(MembershipWorker.name);
  constructor(
    private readonly db: DataSource,
    private readonly billing: BillingService,
    private readonly renewals: MembershipRenewalsService,
    private readonly reminders: MembershipRemindersService,
  ) {}
  onApplicationBootstrap() {
    if (
      getEnv('BILLING_WORKER_ENABLED') === 'false' ||
      getEnv('NODE_ENV') === 'test'
    )
      return;
    this.timer = setInterval(() => {
      void this.runOnce();
    }, 60000);
    this.timer.unref();
    void this.runOnce();
  }
  async onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
    await this.active;
  }
  runOnce() {
    if (this.active) return this.active;
    this.active = this.tick()
      .catch(() => {
        this.logger.error(
          'Membership worker failed; durable jobs will be retried',
        );
      })
      .finally(() => {
        this.active = undefined;
      });
    return this.active;
  }
  private async tick() {
    await this.renewals.processDue();
    if (getEnv('PAYPAL_CLIENT_ID') && getEnv('PAYPAL_CLIENT_SECRET')) {
      const subscriptions = await this.db
        .getRepository(ClinicSubscription)
        .createQueryBuilder('s')
        .where('s.billingMode = :mode AND s.billingProvider = :provider', {
          mode: 'subscription',
          provider: 'paypal',
        })
        .andWhere('s.status IN (:...statuses)', {
          statuses: [
            'trialing',
            'active',
            'incomplete',
            'past_due',
            'suspended',
          ],
        })
        .andWhere(
          '(s.lastWebhookProcessedAt IS NULL OR s.lastWebhookProcessedAt < :cutoff)',
          { cutoff: new Date(Date.now() - 5 * 60000) },
        )
        .orderBy('s.lastWebhookProcessedAt', 'ASC', 'NULLS FIRST')
        .take(50)
        .getMany();
      for (const sub of subscriptions) {
        try {
          await this.billing.confirm(sub.clinicId);
        } catch {
          this.logger.warn(`Could not reconcile membership ${sub.id}`);
        }
      }
    }
    await this.reminders.processDue();
  }
}
