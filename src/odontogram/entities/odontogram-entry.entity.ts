import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { ClinicMembership } from '../../clinic-memberships/entities/clinic-membership.entity';
import { ClinicalNote } from '../../clinical-notes/entities/clinical-note.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { Treatment } from '../../treatments/entities/treatment.entity';
import { ToothStatus } from '../interfaces/tooth-status.enum';
import { ToothSurface } from '../interfaces/tooth-surface.enum';

@Entity('odontogram_entries')
@Unique(['patientId', 'toothCode', 'surface'])
export class OdontogramEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @Column('uuid')
  patientId: string;

  @Column('text')
  toothCode: string;

  @Column({
    type: 'enum',
    enum: ToothSurface,
    default: ToothSurface.FULL,
  })
  surface: ToothSurface;

  @Column({
    type: 'enum',
    enum: ToothStatus,
    default: ToothStatus.HEALTHY,
  })
  status: ToothStatus;

  @Column('uuid', { nullable: true })
  actionGroupId: string | null;

  @Column({ type: 'text', nullable: true })
  treatmentType: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true })
  observation: string | null;

  @ManyToOne(() => ClinicMembership, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'professionalMembershipId' })
  professionalMembership: ClinicMembership | null;

  @Column('uuid', { nullable: true })
  professionalMembershipId: string | null;

  @ManyToOne(() => ClinicalNote, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'clinicalNoteId' })
  clinicalNote: ClinicalNote | null;

  @Column('uuid', { nullable: true })
  clinicalNoteId: string | null;

  @ManyToOne(() => Treatment, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'treatmentId' })
  treatment: Treatment | null;

  @Column('uuid', { nullable: true })
  treatmentId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
