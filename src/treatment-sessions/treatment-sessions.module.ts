import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ClinicalRecord } from '../clinical-records/entities/clinical-record.entity';
import { PatientsModule } from '../patients/patients.module';
import { Treatment } from '../treatments/entities/treatment.entity';
import { TreatmentSession } from './entities/treatment-session.entity';
import { TreatmentSessionsController } from './treatment-sessions.controller';
import { TreatmentSessionsService } from './treatment-sessions.service';

@Module({
  controllers: [TreatmentSessionsController],
  providers: [TreatmentSessionsService],
  imports: [
    PatientsModule,
    TypeOrmModule.forFeature([TreatmentSession, Treatment, ClinicalRecord]),
  ],
  exports: [TypeOrmModule],
})
export class TreatmentSessionsModule {}
