import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ClinicalRecord } from '../clinical-records/entities/clinical-record.entity';
import { PatientsModule } from '../patients/patients.module';
import { ClinicalNotesController } from './clinical-notes.controller';
import { ClinicalNotesService } from './clinical-notes.service';
import { ClinicalNote } from './entities/clinical-note.entity';

@Module({
  controllers: [ClinicalNotesController],
  providers: [ClinicalNotesService],
  imports: [
    PatientsModule,
    TypeOrmModule.forFeature([ClinicalNote, ClinicalRecord]),
  ],
  exports: [TypeOrmModule],
})
export class ClinicalNotesModule {}
