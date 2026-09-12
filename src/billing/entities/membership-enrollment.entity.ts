import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Clinic } from '../../clinics/entities/clinic.entity';

@Entity('membership_enrollments')
@Index(['clinicId', 'requestId'], { unique: true })
export class MembershipEnrollment {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') clinicId: string;
  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinicId' })
  clinic: Clinic;
  @Column('uuid') requestId: string;
  @Column('text') agreementId: string;
  @CreateDateColumn() createdAt: Date;
}
