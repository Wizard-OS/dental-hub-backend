import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Patient } from '../../patients/entities/patient.entity';
import { PatientFile } from '../../patient-files/entities/patient-file.entity';
import { ClinicalNote } from '../../clinical-notes/entities/clinical-note.entity';

export enum PatientExamCategory {
  RADIOGRAPHY = 'radiography',
  CEPHALOMETRY = 'cephalometry',
  PHOTOGRAPHY = 'photography',
  OTHER = 'other',
}

export interface ExamMeasurement {
  name: string;
  value: number;
  unit?: string;
  reference?: string;
}

@Entity('patient_exams')
@Index(['patientId', 'performedAt'])
export class PatientExam {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @Column('uuid')
  patientId: string;

  @Column('text')
  title: string;

  @Column('text')
  category: PatientExamCategory;

  @Column('timestamptz')
  performedAt: Date;

  @Column('text', { nullable: true })
  description: string | null;

  @ManyToOne(() => ClinicalNote, (note) => note.exams, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'clinicalNoteId' })
  clinicalNote: ClinicalNote | null;

  @Column('uuid', { nullable: true })
  clinicalNoteId: string | null;

  @Column('jsonb', { default: [] })
  measurements: ExamMeasurement[];

  @ManyToMany(() => PatientFile)
  @JoinTable({
    name: 'patient_exam_files',
    joinColumn: { name: 'examId' },
    inverseJoinColumn: { name: 'fileId' },
  })
  files: PatientFile[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
