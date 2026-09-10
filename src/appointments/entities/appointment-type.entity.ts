import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Appointment } from './appointment.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';

@Entity('appointment_types')
export class AppointmentType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Clinic, (clinic) => clinic.appointmentTypes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'clinicId' })
  clinic: Clinic;

  @Column('uuid')
  clinicId: string;

  @Column('text')
  name: string;

  @Column('int')
  durationMin: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  defaultPrice: string | null;

  @Column('varchar', { length: 3, default: 'UYU' })
  currency: string;

  @Column('text', { default: '#1f7a8c' })
  color: string;

  @Column('bool', { default: true })
  isActive: boolean;

  @OneToMany(() => Appointment, (appointment) => appointment.appointmentType)
  appointments: Appointment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
