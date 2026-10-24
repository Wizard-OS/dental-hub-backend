import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Appointment } from '../../appointments/entities/appointment.entity';
import { NotificationChannel } from '../../common/interfaces/notification-channel.enum';
import { MessageTemplate } from '../../message-templates/entities/message-template.entity';
import { ReminderStatus } from '../interfaces/reminder-status.enum';
import { ReminderType } from '../interfaces/reminder-type.enum';

@Entity('reminders')
export class Reminder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Appointment, (appointment) => appointment.reminders, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'appointmentId' })
  appointment: Appointment;

  @Column()
  appointmentId: string;

  @Column('enum', {
    enum: ReminderType,
    default: ReminderType.EMAIL,
  })
  type: ReminderType;

  @ManyToOne(() => MessageTemplate, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'templateId' })
  template: MessageTemplate;

  @Column('uuid', { nullable: true })
  templateId: string | null;

  @Column('enum', {
    enum: NotificationChannel,
    default: NotificationChannel.EMAIL,
  })
  channel: NotificationChannel;

  @Column('enum', {
    enum: ReminderStatus,
    default: ReminderStatus.SCHEDULED,
  })
  status: ReminderStatus;

  @Column({ type: 'timestamp' })
  scheduledAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  sentAt: Date | null;

  @Column({ type: 'text', nullable: true })
  error: string | null;
}
