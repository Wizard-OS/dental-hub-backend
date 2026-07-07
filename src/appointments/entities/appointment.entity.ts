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

import { User } from '../../auth/entities/user.entity';
import { AppointmentType } from './appointment-type.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { Reminder } from '../../reminders/entities/reminder.entity';
import { AppointmentStatus } from '../interfaces/AppointmentStatus.enum';
import { ClinicMembership } from '../../clinic-memberships/entities/clinic-membership.entity';

@Entity('appointments')
export class Appointment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Clinic, (clinic) => clinic.appointments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'clinicId' })
  clinic: Clinic;

  @Column('uuid')
  clinicId: string;

  @ManyToOne(() => Patient, (patient) => patient.appointments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @Column('uuid')
  patientId: string;

  @ManyToOne(() => User, (user) => user.appointments, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'dentistId' })
  dentist: User;

  @Column({ nullable: true })
  dentistId: string;

  @ManyToOne(() => ClinicMembership, (membership) => membership.appointments, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'professionalMembershipId' })
  professionalMembership: ClinicMembership;

  @Column('uuid', { nullable: true })
  professionalMembershipId: string | null;

  @ManyToOne(
    () => AppointmentType,
    (appointmentType) => appointmentType.appointments,
    {
      onDelete: 'SET NULL',
    },
  )
  @JoinColumn({ name: 'appointmentTypeId' })
  appointmentType: AppointmentType;

  @Column('uuid', { nullable: true })
  appointmentTypeId: string | null;

  @Column('text')
  description: string;

  @Column({ type: 'timestamp' })
  startTime: Date;

  @Column({ type: 'timestamp' })
  endTime: Date;

  @Column({
    type: 'enum',
    enum: AppointmentStatus,
  })
  status: AppointmentStatus;

  @Column({ nullable: true })
  reason: string;

  @Column('uuid', { nullable: true })
  createdByMembershipId: string | null;

  @Column({ nullable: true, type: 'text' })
  cancelReason: string | null;

  @OneToMany(() => Reminder, (reminder) => reminder.appointment)
  reminders: Reminder[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
