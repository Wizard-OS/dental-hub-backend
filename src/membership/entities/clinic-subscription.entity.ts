import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import type { MembershipQuote } from '../../billing/membership-offer';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { ClinicMembership } from '../../clinic-memberships/entities/clinic-membership.entity';
import { BillingProvider } from '../interfaces/billing-provider.enum';
import { MembershipPlanCode } from '../interfaces/membership-plan-code.enum';
import { SubscriptionStatus } from '../interfaces/subscription-status.enum';

@Entity('clinic_subscriptions')
@Index(['clinicId'], { unique: true })
export class ClinicSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinicId' })
  clinic: Clinic;

  @Column('uuid')
  clinicId: string;

  @Column('enum', {
    enum: MembershipPlanCode,
    enumName: 'clinic_subscriptions_plancode_enum',
    default: MembershipPlanCode.free,
  })
  planCode: MembershipPlanCode;

  @Column('text', { default: '2026-08-mvp' })
  planVersion: string;

  @Column('enum', {
    enum: SubscriptionStatus,
    enumName: 'clinic_subscriptions_status_enum',
    default: SubscriptionStatus.active,
  })
  status: SubscriptionStatus;

  @Column('timestamptz', { default: () => 'now()' })
  startedAt: Date;

  @Column('timestamptz', { nullable: true })
  currentPeriodStart: Date | null;

  @Column('timestamptz', { nullable: true })
  currentPeriodEnd: Date | null;

  @Column('enum', {
    enum: BillingProvider,
    enumName: 'clinic_subscriptions_billingprovider_enum',
    nullable: true,
  })
  billingProvider: BillingProvider | null;

  @Column('text', { nullable: true })
  providerCustomerId: string | null;

  @Column('text', { nullable: true })
  providerSubscriptionId: string | null;

  @Column('text', { nullable: true })
  providerPlanId: string | null;

  @Column('jsonb', { nullable: true })
  checkoutQuote: MembershipQuote | null;

  @Column('timestamptz', { nullable: true })
  trialStartedAt: Date | null;

  @Column('timestamptz', { nullable: true })
  trialEndsAt: Date | null;

  @Column('text', { default: 'subscription' })
  billingMode: 'subscription' | 'vault';

  @Column('uuid', { nullable: true })
  checkoutRequestId: string | null;

  @Column('uuid', { nullable: true })
  selectedPaymentMethodId: string | null;

  @Column('jsonb', { nullable: true })
  paymentMethodSummary: {
    id: string;
    type: string;
    brand: string | null;
    last4: string | null;
    expiry: string | null;
    maskedEmail: string | null;
  } | null;

  @Column('timestamptz', { nullable: true })
  billingAnchorAt: Date | null;

  @Column('timestamptz', { nullable: true })
  nextChargeAt: Date | null;

  @Column('int', { default: 0 })
  paidCycles: number;

  @Column('timestamptz', { nullable: true })
  recurringConsentAt: Date | null;

  @Column('uuid', { nullable: true })
  recurringConsentMembershipId: string | null;

  @Column('timestamptz', { nullable: true })
  reminderDueAt: Date | null;

  @Column('timestamptz', { nullable: true })
  reminderSentAt: Date | null;

  @Column('timestamptz', { nullable: true })
  reminderFirstAttemptAt: Date | null;

  @Column('timestamptz', { nullable: true })
  reminderNextAttemptAt: Date | null;

  @Column('int', { default: 0 })
  reminderAttempts: number;

  @Column('text', { nullable: true })
  reminderError: string | null;

  @Column('text', { nullable: true })
  reminderProviderId: string | null;

  @Column('jsonb', { nullable: true, select: false })
  reminderMessage: { to: string; subject: string; text: string } | null;

  @Column('text', { nullable: true })
  providerStatus: string | null;

  @Column('text', { nullable: true })
  licenseKeyHash: string | null;

  @Column('text', { nullable: true })
  licenseKeySuffix: string | null;

  @Column('timestamptz', { nullable: true })
  licenseIssuedAt: Date | null;

  @Column('timestamptz', { nullable: true })
  licenseActivatedAt: Date | null;

  @Column('bool', { default: false })
  cancelAtPeriodEnd: boolean;

  @Column('text', { nullable: true })
  lastWebhookEventId: string | null;

  @Column('timestamptz', { nullable: true })
  lastWebhookProcessedAt: Date | null;

  @ManyToOne(() => ClinicMembership, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assignedByMembershipId' })
  assignedByMembership: ClinicMembership | null;

  @Column('uuid', { nullable: true })
  assignedByMembershipId: string | null;

  @Column('text', { nullable: true })
  changeReason: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
