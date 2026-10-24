import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ClinicMembership } from '../clinic-memberships/entities/clinic-membership.entity';
import { Patient } from '../patients/entities/patient.entity';
import { PatientProfessionalAssignment } from './entities/patient-professional-assignment.entity';
import { PatientAssignmentsController } from './patient-assignments.controller';
import { PatientAssignmentsService } from './patient-assignments.service';

@Module({
  controllers: [PatientAssignmentsController],
  providers: [PatientAssignmentsService],
  imports: [
    TypeOrmModule.forFeature([
      PatientProfessionalAssignment,
      Patient,
      ClinicMembership,
    ]),
  ],
  exports: [TypeOrmModule, PatientAssignmentsService],
})
export class PatientAssignmentsModule {}
