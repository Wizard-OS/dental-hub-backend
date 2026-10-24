import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MembershipModule } from '../membership/membership.module';
import { ClinicMembershipsController } from './clinic-memberships.controller';
import { ClinicMembershipsService } from './clinic-memberships.service';
import { ClinicMembership } from './entities/clinic-membership.entity';

@Module({
  controllers: [ClinicMembershipsController],
  providers: [ClinicMembershipsService],
  imports: [MembershipModule, TypeOrmModule.forFeature([ClinicMembership])],
  exports: [TypeOrmModule, ClinicMembershipsService],
})
export class ClinicMembershipsModule {}
