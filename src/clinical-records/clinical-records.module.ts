import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Patient } from '../patients/entities/patient.entity';
import { PatientsModule } from '../patients/patients.module';
import { ClinicalRecordsController } from './clinical-records.controller';
import { ClinicalRecordsService } from './clinical-records.service';
import { ClinicalRecord } from './entities/clinical-record.entity';

@Module({
  controllers: [ClinicalRecordsController],
  providers: [ClinicalRecordsService],
  imports: [
    PatientsModule,
    TypeOrmModule.forFeature([ClinicalRecord, Patient]),
  ],
  exports: [TypeOrmModule],
})
export class ClinicalRecordsModule {}
