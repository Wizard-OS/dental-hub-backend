import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { BillingProvider } from '../../membership/interfaces/billing-provider.enum';

@Entity('billing_webhook_events')
@Index(['provider', 'eventId'], { unique: true })
export class BillingWebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('enum', {
    enum: BillingProvider,
    enumName: 'billing_webhook_events_provider_enum',
  })
  provider: BillingProvider;

  @Column('text')
  eventId: string;

  @Column('text')
  eventType: string;

  @Column('text', { nullable: true })
  providerSubscriptionId: string | null;

  @Column('jsonb')
  payload: Record<string, unknown>;

  @Column('timestamptz', { nullable: true })
  processedAt: Date | null;

  @Column('uuid', { nullable: true })
  processingToken: string | null;

  @Column('timestamptz', { nullable: true })
  processingUntil: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
