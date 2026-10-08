import type { Relation } from 'typeorm';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { UserStorageIntegration } from '../../storage/entities/user-storage-integration.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { Treatment } from '../../treatments/entities/treatment.entity';
import { Appointment } from '../../appointments/entities/appointment.entity';
import { ClinicalNote } from '../../clinical-notes/entities/clinical-note.entity';
import { ClinicMembership } from '../../clinic-memberships/entities/clinic-membership.entity';
import { StorageProviderType } from '../../storage/interfaces/storage-provider-type.enum';
import { PatientFileStorageStatus } from '../interfaces/patient-file-storage-status.enum';
import { PatientFileSyncSource } from '../interfaces/patient-file-sync-source.enum';
import { PatientFileType } from '../interfaces/patient-file-type.enum';

@Entity('patient_files')
export class PatientFile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @Column('uuid')
  patientId: string;

  @ManyToOne(() => Appointment, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'appointmentId' })
  appointment: Appointment | null;

  @Column('uuid', { nullable: true })
  appointmentId: string | null;

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

  @ManyToOne(() => ClinicMembership, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'uploadedByMembershipId' })
  uploadedByMembership: ClinicMembership | null;

  @Column('uuid', { nullable: true })
  uploadedByMembershipId: string | null;

  @Column('uuid', { nullable: true })
  uploadedByUserId: string | null;

  @ManyToOne(() => UserStorageIntegration, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'storageIntegrationId' })
  storageIntegration: Relation<UserStorageIntegration> | null;

  @Column('uuid', { nullable: true })
  storageIntegrationId: string | null;

  @Column({
    type: 'enum',
    enum: PatientFileType,
    default: PatientFileType.OTHER,
  })
  type: PatientFileType;

  @Column('text')
  originalName: string;

  @Column('text')
  storedName: string;

  @Column('text')
  path: string;

  @Column('text')
  url: string;

  @Column('text')
  mimeType: string;

  @Column('int')
  size: number;

  @Column({
    type: 'enum',
    enum: StorageProviderType,
    enumName: 'storage_provider_type_enum',
    default: StorageProviderType.LOCAL,
  })
  storageProvider: StorageProviderType;

  @Column({
    type: 'enum',
    enum: PatientFileStorageStatus,
    enumName: 'patient_file_storage_status_enum',
    default: PatientFileStorageStatus.AVAILABLE,
  })
  storageStatus: PatientFileStorageStatus;

  @Column('bool', { default: false })
  syncReviewRequired: boolean;

  @Column('text', { nullable: true })
  syncReviewReason: string | null;

  @Column({
    type: 'enum',
    enum: PatientFileSyncSource,
    enumName: 'patient_file_sync_source_enum',
    default: PatientFileSyncSource.APP,
  })
  syncSource: PatientFileSyncSource;

  @Column('text', { nullable: true })
  driveFileId: string | null;

  @Column('text', { nullable: true })
  driveFolderId: string | null;

  @Column('text', { nullable: true })
  checksum: string | null;

  @Column('timestamptz', { nullable: true })
  driveModifiedAt: Date | null;

  @Column('jsonb', { default: {} })
  externalMetadataJson: Record<string, unknown>;

  @Column('text', { nullable: true })
  description: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
