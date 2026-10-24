import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Appointment } from '../../appointments/entities/appointment.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { NotificationChannel } from '../../common/interfaces/notification-channel.enum';
import { MessageTemplate } from '../../message-templates/entities/message-template.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { OutboundMessageStatus } from '../interfaces/outbound-message-status.enum';

@Entity('outbound_messages')
export class OutboundMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Clinic, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'clinicId' })
  clinic: Clinic;

  @Column('uuid')
  clinicId: string;

  @ManyToOne(() => Patient, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @Column('uuid', { nullable: true })
  patientId: string | null;

  @ManyToOne(() => Appointment, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'appointmentId' })
  appointment: Appointment;

  @Column('uuid', { nullable: true })
  appointmentId: string | null;

  @ManyToOne(() => MessageTemplate, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'templateId' })
  template: MessageTemplate;

  @Column('uuid', { nullable: true })
  templateId: string | null;

  @Column('enum', {
    enum: NotificationChannel,
  })
  channel: NotificationChannel;

  @Column('jsonb', { default: {} })
  payloadJson: Record<string, unknown>;

  @Column('enum', {
    enum: OutboundMessageStatus,
    default: OutboundMessageStatus.QUEUED,
  })
  status: OutboundMessageStatus;

  @Column('text', { nullable: true })
  providerMessageId: string | null;

  @Column('text', { nullable: true })
  error: string | null;

  @Column({ type: 'timestamp', nullable: true })
  sentAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
