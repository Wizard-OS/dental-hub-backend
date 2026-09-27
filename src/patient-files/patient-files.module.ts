import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Patient } from '../patients/entities/patient.entity';
import { PatientsModule } from '../patients/patients.module';
import { Treatment } from '../treatments/entities/treatment.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { ClinicalNote } from '../clinical-notes/entities/clinical-note.entity';
import { PatientFile } from './entities/patient-file.entity';
import { PatientFilesService } from './patient-files.service';
import { PatientFilesController } from './patient-files.controller';
import { MembershipModule } from '../membership/membership.module';
import { StorageModule } from '../storage/storage.module';
import { PatientFileScopeService } from './services/patient-file-scope.service';

@Module({
  controllers: [PatientFilesController],
  providers: [PatientFilesService, PatientFileScopeService],
  imports: [
    MembershipModule,
    StorageModule,
    PatientsModule,
    TypeOrmModule.forFeature([
      PatientFile,
      Patient,
      Appointment,
      ClinicalNote,
      Treatment,
    ]),
  ],
  exports: [TypeOrmModule, PatientFilesService],
})
export class PatientFilesModule {}
