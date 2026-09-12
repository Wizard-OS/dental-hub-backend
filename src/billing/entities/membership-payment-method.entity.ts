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

@Entity('membership_payment_methods')
@Index(['providerTokenId'], { unique: true })
@Index('uq_membership_default_method', ['clinicId'], {
  unique: true,
  where: '"isDefault" = true AND "deletedAt" IS NULL',
})
export class MembershipPaymentMethod {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') clinicId: string;
  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinicId' })
  clinic: Clinic;
  @Column('text', { select: false }) providerTokenId: string;
  @Column('text', { select: false }) providerCustomerId: string;
  @Column('text') type: 'card' | 'paypal';
  @Column('text', { nullable: true }) brand: string | null;
  @Column('text', { nullable: true }) last4: string | null;
  @Column('text', { nullable: true }) expiry: string | null;
  @Column('text', { nullable: true }) maskedEmail: string | null;
  @Column('bool', { default: false }) isDefault: boolean;
  @Column('timestamptz', { nullable: true }) deletedAt: Date | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
