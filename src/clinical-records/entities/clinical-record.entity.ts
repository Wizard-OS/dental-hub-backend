import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Patient } from '../../patients/entities/patient.entity';
import { ClinicalNote } from '../../clinical-notes/entities/clinical-note.entity';
import { TreatmentSession } from '../../treatment-sessions/entities/treatment-session.entity';

@Entity('clinical_records')
export class ClinicalRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => Patient, (patient) => patient.clinicalRecord, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @Column({ unique: true })
  patientId: string;

  @Column({ nullable: true, type: 'text' })
  allergies: string;

  @Column({ nullable: true, type: 'text' })
  chronicDiseases: string;

  @Column({ nullable: true, type: 'text' })
  medicalHistory: string | null;

  @Column({ nullable: true, type: 'text' })
  dentalHistory: string | null;

  @Column({ nullable: true, type: 'text' })
  observations: string | null;

  @Column('text', { nullable: true })
  bloodType: string | null;

  @Column('text', { nullable: true })
  healthInsurance: string | null;

  @Column('text', { nullable: true })
  currentMedication: string | null;

  @Column('text', { nullable: true })
  habits: string | null;

  @OneToMany(() => ClinicalNote, (note) => note.clinicalRecord)
  notes: ClinicalNote[];

  @OneToMany(() => TreatmentSession, (session) => session.clinicalRecord)
  treatmentSessions: TreatmentSession[];

  @CreateDateColumn()
  createdAt: Date;
}
