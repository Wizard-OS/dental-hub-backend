import { PatientExam } from '../../patient-exams/entities/patient-exam.entity';
import { PatientFile } from '../../patient-files/entities/patient-file.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  OneToMany,
} from 'typeorm';

import { User } from '../../auth/entities/user.entity';
import { ClinicalRecord } from '../../clinical-records/entities/clinical-record.entity';
import { ClinicMembership } from '../../clinic-memberships/entities/clinic-membership.entity';

@Entity('clinical_notes')
export class ClinicalNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ClinicalRecord, (record) => record.notes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'clinicalRecordId' })
  clinicalRecord: ClinicalRecord;

  @Column()
  clinicalRecordId: string;

  @ManyToOne(() => User, (user) => user.clinicalNotes)
  @JoinColumn({ name: 'authorId' })
  author: User;

  @Column()
  authorId: string;

  @ManyToOne(() => ClinicMembership, (membership) => membership.clinicalNotes, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'authorMembershipId' })
  authorMembership: ClinicMembership;

  @Column('uuid', { nullable: true })
  authorMembershipId: string | null;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'text', nullable: true })
  diagnosis: string | null;

  @Column({ type: 'text', nullable: true })
  procedure: string | null;

  @Column({ type: 'text', nullable: true })
  indications: string | null;

  @Column({ type: 'text', nullable: true })
  observations: string | null;

  @Column('text', { array: true, default: [] })
  toothCodes: string[];

  @Column('text', { nullable: true })
  title: string | null;

  @Column('timestamptz', { default: () => 'CURRENT_TIMESTAMP' })
  occurredAt: Date;

  @OneToMany(() => PatientFile, (file) => file.clinicalNote)
  files: PatientFile[];

  @OneToMany(() => PatientExam, (exam) => exam.clinicalNote)
  exams: PatientExam[];

  @CreateDateColumn()
  createdAt: Date;
}
