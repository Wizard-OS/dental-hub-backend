import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Clinic } from '../../clinics/entities/clinic.entity';

@Entity('membership_setup_sessions')
@Index(['clinicId', 'requestId'], { unique: true })
export class MembershipSetupSession {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') clinicId: string;
  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinicId' })
  clinic: Clinic;
  @Column('uuid') requestId: string;
  @Column('text') type: 'card' | 'paypal';
  @Column('text', { nullable: true }) providerSetupTokenId: string | null;
  @Column('text', { nullable: true }) approvedCustomerId: string | null;
  @Column('text', { nullable: true }) providerPaymentTokenId: string | null;
  @Column('text', { nullable: true }) approvalUrl: string | null;
  @Column('text', { default: 'created' }) status: string;
  @Column('uuid', { nullable: true }) paymentMethodId: string | null;
  @Column('timestamptz') expiresAt: Date;
  @CreateDateColumn() createdAt: Date;
}
