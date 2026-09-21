import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProfessionalSpecialty } from './entities/professional-specialty.entity';
import { ProfessionalSpecialtiesController } from './professional-specialties.controller';
import { ProfessionalSpecialtiesService } from './professional-specialties.service';

@Module({
  imports: [TypeOrmModule.forFeature([ProfessionalSpecialty])],
  controllers: [ProfessionalSpecialtiesController],
  providers: [ProfessionalSpecialtiesService],
  exports: [ProfessionalSpecialtiesService, TypeOrmModule],
})
export class ProfessionalSpecialtiesModule {}
