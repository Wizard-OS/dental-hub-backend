import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ClinicMembership } from '../clinic-memberships/entities/clinic-membership.entity';
import { ClinicsModule } from '../clinics/clinics.module';
import { Patient } from '../patients/entities/patient.entity';
import { PatientsModule } from '../patients/patients.module';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { Appointment } from './entities/appointment.entity';
import { AppointmentType } from './entities/appointment-type.entity';

@Module({
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
  imports: [
    PatientsModule,
    ClinicsModule,
    TypeOrmModule.forFeature([
      Appointment,
      AppointmentType,
      Patient,
      ClinicMembership,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class AppointmentsModule {}
