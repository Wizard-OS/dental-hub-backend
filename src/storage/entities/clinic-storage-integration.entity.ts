import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { Clinic } from '../../clinics/entities/clinic.entity';
import { StorageIntegrationStatus } from '../interfaces/storage-integration-status.enum';
import { StorageProviderType } from '../interfaces/storage-provider-type.enum';

@Entity('clinic_storage_integrations')
@Unique(['clinicId', 'provider'])
export class ClinicStorageIntegration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinicId' })
  clinic: Clinic;

  @Index()
  @Column('uuid')
  clinicId: string;

  @Column({
    type: 'enum',
    enum: StorageProviderType,
    enumName: 'storage_provider_type_enum',
    default: StorageProviderType.GOOGLE_DRIVE,
  })
  provider: StorageProviderType;

  @Column({
    type: 'enum',
    enum: StorageIntegrationStatus,
    enumName: 'storage_integration_status_enum',
    default: StorageIntegrationStatus.DISCONNECTED,
  })
  status: StorageIntegrationStatus;

  @Column('text', { nullable: true })
  rootFolderId: string | null;

  @Column('text', { nullable: true })
  patientsFolderId: string | null;

  @Column('text', { nullable: true })
  encryptedAccessToken: string | null;

  @Column('text', { nullable: true })
  encryptedRefreshToken: string | null;

  @Column('timestamptz', { nullable: true })
  tokenExpiresAt: Date | null;

  @Column('text', { nullable: true })
  driveStartPageToken: string | null;

  @Column('jsonb', { default: {} })
  metadataJson: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
