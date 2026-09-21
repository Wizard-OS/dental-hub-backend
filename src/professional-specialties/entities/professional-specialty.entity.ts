import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('professional_specialties')
@Index(['code'], { unique: true })
export class ProfessionalSpecialty {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  code: string;

  @Column('text')
  name: string;

  @Column('bool', { default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  normalize() {
    this.code = this.code.trim().toLowerCase();
    this.name = this.name.trim();
  }
}
