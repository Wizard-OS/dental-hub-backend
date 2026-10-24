import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { Appointment } from '../../appointments/entities/appointment.entity';
import { ClinicalRecord } from '../../clinical-records/entities/clinical-record.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { Gender } from '../../common/interfaces/gender.enum';
import { Invoice } from '../../invoices/entities/invoice.entity';
import { PatientFile } from '../../patient-files/entities/patient-file.entity';

@Entity('patients')
@Index(['clinicId'])
@Unique(['clinicId', 'email'])
@Unique(['clinicId', 'phone'])
@Unique(['clinicId', 'documentId'])
export class Patient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Clinic, (clinic) => clinic.patients, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'clinicId' })
  clinic: Clinic;

  @Column('uuid')
  clinicId: string;

  @Column('text', {
    nullable: true,
  })
  email: string | null;

  @Column('text')
  firstName: string;

  @Column('text')
  lastName: string;

  @Column('text', {
    nullable: true,
  })
  documentId: string | null;

  @Column('date')
  birthDate: Date;

  @Column('enum', {
    enum: Gender,
  })
  gender: Gender;

  @Column('text', {
    nullable: true,
  })
  address: string;

  @Column('text', {
    nullable: true,
  })
  profession: string | null;

  @Column('text', {
    nullable: true,
  })
  streetAddress: string | null;

  @Column('text', {
    nullable: true,
  })
  addressNumber: string | null;

  @Column('text', {
    nullable: true,
  })
  neighborhood: string | null;

  @Column('text', {
    nullable: true,
  })
  city: string | null;

  @Column('text', {
    nullable: true,
  })
  postalCode: string | null;

  @Column('text', {
    nullable: true,
  })
  phone: string | null;

  @ManyToOne(() => PatientFile, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'profilePhotoFileId' })
  profilePhotoFile: PatientFile | null;

  @Column('uuid', {
    nullable: true,
  })
  profilePhotoFileId: string | null;

  @Column('text', {
    nullable: true,
  })
  profilePhotoUrl: string | null;

  @Column('text', {
    nullable: true,
  })
  emergencyContact: string | null;

  @Column('text', {
    nullable: true,
  })
  observations: string | null;

  @Column('text', {
    nullable: true,
  })
  medicalHistory: string | null;

  @Column('text', {
    nullable: true,
  })
  dentalHistory: string | null;

  @OneToMany(() => Appointment, (appointment) => appointment.patient)
  appointments: Appointment[];

  @OneToOne(() => ClinicalRecord, (record) => record.patient, {
    cascade: true,
  })
  clinicalRecord: ClinicalRecord;

  @OneToMany(() => Invoice, (invoice) => invoice.patient)
  invoices: Invoice[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date | null;

  @BeforeInsert()
  checkFieldsBeforeInsert() {
    if (this.email) {
      this.email = this.email.toLowerCase().trim();
    }

    if (this.documentId) {
      this.documentId = this.documentId.trim();
    }

    if (this.phone) {
      this.phone = this.phone.trim();
    }

    if (this.profession) {
      this.profession = this.profession.trim();
    }

    if (this.streetAddress) {
      this.streetAddress = this.streetAddress.trim();
    }

    if (this.addressNumber) {
      this.addressNumber = this.addressNumber.trim();
    }

    if (this.neighborhood) {
      this.neighborhood = this.neighborhood.trim();
    }

    if (this.city) {
      this.city = this.city.trim();
    }

    if (this.postalCode) {
      this.postalCode = this.postalCode.trim();
    }
  }

  @BeforeUpdate()
  checkFieldsBeforeUpdate() {
    this.checkFieldsBeforeInsert();
  }
}
