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

@Entity('user_sessions')
@Index(['userId', 'isRevoked', 'lastActiveAt'])
export class UserSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column('text', { nullable: true })
  deviceName: string;

  @Column('text', { nullable: true })
  deviceType: string;

  @Column('text', { nullable: true })
  browserName: string;

  @Column('text', { nullable: true })
  osName: string;

  @Column('text', { nullable: true })
  ipAddress: string;

  @Column('text', { nullable: true })
  userAgent: string;

  @Column('timestamp', { default: () => 'CURRENT_TIMESTAMP' })
  lastActiveAt: Date;

  @Column('bool', { default: false })
  isRevoked: boolean;

  @Column('timestamp', { nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
