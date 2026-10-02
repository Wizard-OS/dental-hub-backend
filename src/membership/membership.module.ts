import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ClinicMembership } from '../clinic-memberships/entities/clinic-membership.entity';
import { PatientFile } from '../patient-files/entities/patient-file.entity';
import { Patient } from '../patients/entities/patient.entity';
import { ClinicSubscriptionAuditLog } from './entities/clinic-subscription-audit-log.entity';
import { ClinicSubscription } from './entities/clinic-subscription.entity';
import { OutboundMessagesModule } from '../outbound-messages/outbound-messages.module';
import { MembershipController } from './membership.controller';
import { MembershipService } from './membership.service';
import { MembershipEntitlementsService } from './membership-entitlements.service';
import { MembershipCheckoutIntentService } from './membership-checkout-intent.service';
import { MembershipPlanAssignmentService } from './membership-plan-assignment.service';
import { MembershipLicenseService } from './membership-license.service';

@Module({
  controllers: [MembershipController],
  providers: [
    MembershipService,
    MembershipEntitlementsService,
    MembershipCheckoutIntentService,
    MembershipPlanAssignmentService,
    MembershipLicenseService,
  ],
  imports: [
    OutboundMessagesModule,
    TypeOrmModule.forFeature([
      ClinicSubscription,
      ClinicSubscriptionAuditLog,
      ClinicMembership,
      Patient,
      PatientFile,
    ]),
  ],
  exports: [TypeOrmModule, MembershipService],
})
export class MembershipModule {}
