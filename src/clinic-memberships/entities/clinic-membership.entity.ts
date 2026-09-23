import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { User } from '../../auth/entities/user.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { Appointment } from '../../appointments/entities/appointment.entity';
import { ClinicalNote } from '../../clinical-notes/entities/clinical-note.entity';
import { ClinicMembershipRole } from '../interfaces/clinic-membership-role.enum';

@Entity('clinic_memberships')
@Unique(['clinicId', 'userId'])
export class ClinicMembership {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Clinic, (clinic) => clinic.memberships, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'clinicId' })
  clinic: Clinic;

  @Column('uuid')
  clinicId: string;

  @ManyToOne(() => User, (user) => user.memberships, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column('uuid')
  userId: string;

  @Column('enum', {
    enum: ClinicMembershipRole,
    default: ClinicMembershipRole.odontologist,
  })
  role: ClinicMembershipRole;

  @Column('jsonb', {
    default: {},
  })
  permissionsJson: Record<string, boolean>;

  @Column('jsonb', {
    nullable: true,
  })
  appointmentSettingsJson: Record<string, unknown> | null;

  @Column('bool', {
    default: true,
  })
  isActive: boolean;

  @OneToMany(
    () => Appointment,
    (appointment) => appointment.professionalMembership,
  )
  appointments: Appointment[];

  @OneToMany(() => ClinicalNote, (note) => note.authorMembership)
  clinicalNotes: ClinicalNote[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
