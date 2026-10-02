import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Clinic } from './entities/clinic.entity';
import { ClinicsController } from './clinics.controller';
import { ClinicsService } from './clinics.service';
import { AppointmentAvailabilityService } from './appointment-availability.service';
import { AppointmentSettingsPolicy } from './appointment-settings.policy';
import { ClinicMembership } from '../clinic-memberships/entities/clinic-membership.entity';
import { CommonModule } from '../common/common.module';

@Module({
  controllers: [ClinicsController],
  providers: [
    ClinicsService,
    AppointmentAvailabilityService,
    AppointmentSettingsPolicy,
  ],
  imports: [CommonModule, TypeOrmModule.forFeature([Clinic, ClinicMembership])],
  exports: [TypeOrmModule, ClinicsService, AppointmentAvailabilityService],
})
export class ClinicsModule {}
