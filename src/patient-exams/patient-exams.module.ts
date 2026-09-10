import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatientExam } from './entities/patient-exam.entity';
import { PatientFile } from '../patient-files/entities/patient-file.entity';
import { ClinicalNote } from '../clinical-notes/entities/clinical-note.entity';
import { PatientsModule } from '../patients/patients.module';
import { PatientExamsController } from './patient-exams.controller';
import { PatientExamsService } from './patient-exams.service';

@Module({
  imports: [
    PatientsModule,
    TypeOrmModule.forFeature([PatientExam, PatientFile, ClinicalNote]),
  ],
  controllers: [PatientExamsController],
  providers: [PatientExamsService],
})
export class PatientExamsModule {}
