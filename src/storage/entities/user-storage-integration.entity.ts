import type { Relation } from 'typeorm';
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
import { User } from '../../auth/entities/user.entity';
import { StorageIntegrationStatus } from '../interfaces/storage-integration-status.enum';

@Entity('user_storage_integrations')
export class UserStorageIntegration {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index({ unique: true }) @Column('uuid') userId: string;
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: Relation<User>;
  @Column('text') googleSubject: string;
  @Column('text') googleEmail: string;
  @Column({
    type: 'enum',
    enum: StorageIntegrationStatus,
    enumName: 'storage_integration_status_enum',
    default: StorageIntegrationStatus.DISCONNECTED,
  })
  status: StorageIntegrationStatus;
  @Column('text', { nullable: true }) rootFolderId: string | null;
  @Column('text', { nullable: true, select: false }) encryptedAccessToken:
    string | null;
  @Column('text', { nullable: true, select: false }) encryptedRefreshToken:
    string | null;
  @Column('timestamptz', { nullable: true }) tokenExpiresAt: Date | null;
  @Column('text', { nullable: true }) driveStartPageToken: string | null;
  @Column('text', { nullable: true }) driveWatchChannelId: string | null;
  @Column('text', { nullable: true }) driveWatchResourceId: string | null;
  @Column('text', { nullable: true, select: false }) driveWatchTokenHash:
    string | null;
  @Column('timestamptz', { nullable: true }) driveWatchExpiresAt: Date | null;
  @Column('jsonb', { default: {} }) metadataJson: Record<string, unknown>;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
