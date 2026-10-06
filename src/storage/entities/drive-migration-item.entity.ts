import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('drive_migration_items')
@Index(['integrationId', 'fileId'], { unique: true })
export class DriveMigrationItem {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') integrationId: string;
  @Column('uuid') fileId: string;
  @Column('text', { default: 'pending' }) status:
    'pending' | 'running' | 'complete' | 'failed' | 'skipped';
  @Column('text', { nullable: true }) error: string | null;
  @Column('timestamptz', { nullable: true }) leaseUntil: Date | null;
  @UpdateDateColumn() updatedAt: Date;
}
