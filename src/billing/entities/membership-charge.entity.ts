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
import { Clinic } from '../../clinics/entities/clinic.entity';

@Entity('membership_charges')
@Index(['agreementId', 'cycle'], { unique: true })
@Index(['providerOrderId'], { unique: true })
export class MembershipCharge {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') clinicId: string;
  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinicId' })
  clinic: Clinic;
  @Column('text') agreementId: string;
  @Column('int') cycle: number;
  @Column('int') amount: number;
  @Column('text', { default: 'USD' }) currency: string;
  @Column('timestamptz') dueAt: Date;
  @Column('timestamptz') periodEnd: Date;
  @Column('text', { default: 'pending' }) status:
    'pending' | 'paid' | 'action_required' | 'failed' | 'refunded';
  @Column('text', { nullable: true }) providerOrderId: string | null;
  @Column('text', { nullable: true }) providerCaptureId: string | null;
  @Column('text', { nullable: true }) approvalUrl: string | null;
  @Column('int', { default: 0 }) attempts: number;
  @Column('timestamptz', { nullable: true }) firstAttemptAt: Date | null;
  @Column('timestamptz', { nullable: true }) nextAttemptAt: Date | null;
  @Column('timestamptz', { nullable: true }) paidAt: Date | null;
  @Column('text', { nullable: true }) error: string | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
