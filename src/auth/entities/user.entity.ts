import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { ValidRoles } from '../interfaces';
import { Appointment } from '../../appointments/entities/appointment.entity';
import { ClinicalNote } from '../../clinical-notes/entities/clinical-note.entity';
import { ClinicMembership } from '../../clinic-memberships/entities/clinic-membership.entity';
import { ProfessionalSpecialty } from '../../professional-specialties/entities/professional-specialty.entity';

@Entity('users')
@Index(['email'], { unique: true })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text', {
    unique: true,
  })
  email: string;

  @Column('text', {
    select: false,
  })
  password: string;

  @Column('text')
  firstName: string;

  @Column('text')
  lastName: string;

  @Column('bool', {
    default: true,
  })
  isActive: boolean;

  @Column('enum', {
    enum: ValidRoles,
    array: true,
    default: [ValidRoles.odontologist],
  })
  roles: ValidRoles[];

  @Column('text', {
    nullable: true,
  })
  phone?: string;

  @Column('text', {
    nullable: true,
  })
  profilePhotoUrl?: string;

  @Column('timestamp', {
    nullable: true,
  })
  birthDate?: Date | null;

  @Column('text', {
    nullable: true,
  })
  professionalLicenseNumber?: string | null;

  @Column('text', {
    nullable: true,
  })
  rut?: string | null;

  @Column('uuid', {
    nullable: true,
  })
  professionalSpecialtyId?: string | null;

  @ManyToOne(() => ProfessionalSpecialty, { nullable: true })
  @JoinColumn({ name: 'professionalSpecialtyId' })
  professionalSpecialty?: ProfessionalSpecialty | null;

  @Column('text', {
    nullable: true,
    select: false,
  })
  passwordResetOtpHash?: string | null;

  @Column('timestamp', {
    nullable: true,
    select: false,
  })
  passwordResetOtpExpiresAt?: Date | null;

  @Column('timestamp', {
    nullable: true,
    select: false,
  })
  passwordResetOtpUsedAt?: Date | null;

  @OneToMany(() => Appointment, (appointment) => appointment.dentist)
  appointments: Appointment[];

  @OneToMany(() => ClinicalNote, (note) => note.author)
  clinicalNotes: ClinicalNote[];

  @OneToMany(() => ClinicMembership, (membership) => membership.user)
  memberships: ClinicMembership[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  checkFieldsBeforeInsert() {
    this.email = this.email.toLowerCase().trim();
  }

  @BeforeUpdate()
  checkFieldsBeforeUpdate() {
    this.checkFieldsBeforeInsert();
  }
}
