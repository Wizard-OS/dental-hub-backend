import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { ClinicMembership } from '../../clinic-memberships/entities/clinic-membership.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { MembershipPlanCode } from '../interfaces/membership-plan-code.enum';

@Entity('clinic_subscription_audit_logs')
export class ClinicSubscriptionAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinicId' })
  clinic: Clinic;

  @Column('uuid')
  clinicId: string;

  @Column('enum', {
    enum: MembershipPlanCode,
    enumName: 'clinic_subscription_audit_logs_previousplancode_enum',
    nullable: true,
  })
  previousPlanCode: MembershipPlanCode | null;

  @Column('enum', {
    enum: MembershipPlanCode,
    enumName: 'clinic_subscription_audit_logs_nextplancode_enum',
  })
  nextPlanCode: MembershipPlanCode;

  @ManyToOne(() => ClinicMembership, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'changedByMembershipId' })
  changedByMembership: ClinicMembership | null;

  @Column('uuid', { nullable: true })
  changedByMembershipId: string | null;

  @Column('text', { nullable: true })
  reason: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
