import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ClinicMembership } from '../clinic-memberships/entities/clinic-membership.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { Patient } from '../patients/entities/patient.entity';
import { PatientsModule } from '../patients/patients.module';
import { Treatment } from './entities/treatment.entity';
import { TreatmentsController } from './treatments.controller';
import { TreatmentsService } from './treatments.service';

@Module({
  controllers: [TreatmentsController],
  providers: [TreatmentsService],
  imports: [
    PatientsModule,
    TypeOrmModule.forFeature([Treatment, Patient, ClinicMembership, Invoice]),
  ],
  exports: [TypeOrmModule],
})
export class TreatmentsModule {}
