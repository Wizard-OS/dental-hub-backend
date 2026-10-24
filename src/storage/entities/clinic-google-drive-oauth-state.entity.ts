import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { User } from '../../auth/entities/user.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';

@Entity('clinic_google_drive_oauth_states')
@Index('uq_clinic_google_drive_oauth_states_state_hash', ['stateHash'], {
  unique: true,
})
export class ClinicGoogleDriveOAuthState {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  clinicId: string;

  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinicId' })
  clinic: Clinic;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column('text')
  redirectUri: string;

  @Column('text')
  stateHash: string;

  @Column('timestamptz')
  expiresAt: Date;

  @Column('timestamptz', { nullable: true })
  consumedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
