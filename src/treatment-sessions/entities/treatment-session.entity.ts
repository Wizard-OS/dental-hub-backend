import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { ClinicalRecord } from '../../clinical-records/entities/clinical-record.entity';
import { Treatment } from '../../treatments/entities/treatment.entity';

@Entity('treatment_sessions')
export class TreatmentSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ClinicalRecord, (record) => record.treatmentSessions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'clinicalRecordId' })
  clinicalRecord: ClinicalRecord;

  @Column()
  clinicalRecordId: string;

  @ManyToOne(() => Treatment, (treatment) => treatment.sessions)
  @JoinColumn({ name: 'treatmentId' })
  treatment: Treatment;

  @Column()
  treatmentId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: string;

  @Column({ type: 'timestamp' })
  performedAt: Date;
}
