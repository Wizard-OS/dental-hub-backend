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

import { ClinicMembership } from '../../clinic-memberships/entities/clinic-membership.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { Patient } from '../../patients/entities/patient.entity';

@Entity('patient_professional_assignments')
@Index(['clinicId', 'patientId'])
@Index(['clinicId', 'professionalMembershipId'])
export class PatientProfessionalAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinicId' })
  clinic: Clinic;

  @Column('uuid')
  clinicId: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @Column('uuid')
  patientId: string;

  @ManyToOne(() => ClinicMembership, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'professionalMembershipId' })
  professionalMembership: ClinicMembership;

  @Column('uuid')
  professionalMembershipId: string;

  @ManyToOne(() => ClinicMembership, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'assignedByMembershipId' })
  assignedByMembership: ClinicMembership;

  @Column('uuid')
  assignedByMembershipId: string;

  @Column('bool', { default: true })
  isActive: boolean;

  @ManyToOne(() => ClinicMembership, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'revokedByMembershipId' })
  revokedByMembership: ClinicMembership | null;

  @Column('uuid', { nullable: true })
  revokedByMembershipId: string | null;

  @Column('timestamptz', { nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
