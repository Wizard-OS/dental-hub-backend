import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { ClinicMembership } from '../../clinic-memberships/entities/clinic-membership.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { TreatmentSession } from '../../treatment-sessions/entities/treatment-session.entity';
import { TreatmentStatus } from '../interfaces/treatment-status.enum';

@Entity('treatments')
export class Treatment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  name: string;

  @Column('uuid')
  patientId: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @Column('uuid')
  doctorId: string;

  @ManyToOne(() => ClinicMembership, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'professionalMembershipId' })
  professionalMembership: ClinicMembership | null;

  @Column('uuid', { nullable: true })
  professionalMembershipId: string | null;

  @Column('text', { nullable: true })
  toothCode: string | null;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  basePrice: string;

  @Column({
    type: 'enum',
    enum: TreatmentStatus,
    default: TreatmentStatus.PROPOSED,
  })
  status: TreatmentStatus;

  @Column('uuid', { nullable: true })
  invoiceId: string | null;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => TreatmentSession, (session) => session.treatment)
  sessions: TreatmentSession[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
