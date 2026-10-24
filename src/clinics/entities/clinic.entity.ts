import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Appointment } from '../../appointments/entities/appointment.entity';
import { AppointmentType } from '../../appointments/entities/appointment-type.entity';
import { ClinicMembership } from '../../clinic-memberships/entities/clinic-membership.entity';
import { Invoice } from '../../invoices/entities/invoice.entity';
import { Patient } from '../../patients/entities/patient.entity';

@Entity('clinics')
export class Clinic {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  name: string;

  @Column('text', { nullable: true })
  phone: string | null;

  @Column('text', { nullable: true })
  email: string | null;

  @Column('text', { nullable: true })
  address: string | null;

  @Column('text', { nullable: true })
  logoUrl: string | null;

  @Column('text', { default: 'America/Montevideo' })
  timezone: string;

  @Column('text', { default: 'UY' })
  countryCode: string;

  @Column('text', { default: 'Uruguay' })
  countryName: string;

  @Column('text', { default: 'USD' })
  currency: string;

  @Column('text', {
    array: true,
    default: () => "ARRAY['598']::text[]",
  })
  callingCodes: string[];

  @Column('text', { default: '598' })
  defaultCallingCode: string;

  @Column('jsonb', { default: {} })
  workingHoursJson: Record<string, unknown>;

  @Column('bool', { default: true })
  isActive: boolean;

  @OneToMany(() => ClinicMembership, (membership) => membership.clinic)
  memberships: ClinicMembership[];

  @OneToMany(() => Patient, (patient) => patient.clinic)
  patients: Patient[];

  @OneToMany(() => Appointment, (appointment) => appointment.clinic)
  appointments: Appointment[];

  @OneToMany(() => AppointmentType, (appointmentType) => appointmentType.clinic)
  appointmentTypes: AppointmentType[];

  @OneToMany(() => Invoice, (invoice) => invoice.clinic)
  invoices: Invoice[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
