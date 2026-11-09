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

@Entity('user_notifications')
@Index(['userId', 'createdAt'])
export class UserNotification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column('text')
  title: string;

  @Column('text')
  body: string;

  @Column('jsonb', { default: {} })
  data: Record<string, unknown>;

  @Column('bool', { default: false })
  isRead: boolean;

  @Column('bool', { default: false })
  isDismissed: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}
