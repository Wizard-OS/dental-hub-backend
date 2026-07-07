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

import { Patient } from '../../patients/entities/patient.entity';
import { Payment } from '../../payments/entities/payment.entity';
import { InvoiceStatus } from '../InvoiceStatus/InvoiceStatus.enum';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { InvoiceItem } from './invoice-item.entity';

@Entity('invoices')
@Unique(['clinicId', 'number'])
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Clinic, (clinic) => clinic.invoices, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'clinicId' })
  clinic: Clinic;

  @Column('uuid')
  clinicId: string;

  @ManyToOne(() => Patient, (patient) => patient.invoices)
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @Column()
  patientId: string;

  @Column('text')
  number: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: '0' })
  subtotal: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: '0' })
  discount: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: '0' })
  tax: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  totalAmount: string;

  @Column({
    type: 'enum',
    enum: InvoiceStatus,
  })
  status: InvoiceStatus;

  @OneToMany(() => Payment, (payment) => payment.invoice)
  payments: Payment[];

  @OneToMany(() => InvoiceItem, (item) => item.invoice)
  items: InvoiceItem[];

  @CreateDateColumn()
  issuedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  dueAt: Date | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
