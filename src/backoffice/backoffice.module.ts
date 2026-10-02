import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from '../auth/entities/user.entity';
import { Clinic } from '../clinics/entities/clinic.entity';
import { Patient } from '../patients/entities/patient.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { UserSession } from '../user-sessions/entities/user-session.entity';
import { ClinicMembership } from '../clinic-memberships/entities/clinic-membership.entity';
import { SupportRequest } from '../help-center/entities/support-request.entity';
import { ClinicSubscription } from '../membership/entities/clinic-subscription.entity';
import { MembershipModule } from '../membership/membership.module';
import { BackofficeController } from './backoffice.controller';
import { BackofficeService } from './backoffice.service';
import { BackofficeOverviewService } from './backoffice-overview.service';
import { BackofficeClinicsService } from './backoffice-clinics.service';
import { BackofficeUsersService } from './backoffice-users.service';
import { BackofficeSupportRequestsService } from './backoffice-support-requests.service';

@Module({
  controllers: [BackofficeController],
  providers: [
    BackofficeService,
    BackofficeOverviewService,
    BackofficeClinicsService,
    BackofficeUsersService,
    BackofficeSupportRequestsService,
  ],
  imports: [
    MembershipModule,
    TypeOrmModule.forFeature([
      Clinic,
      User,
      ClinicMembership,
      ClinicSubscription,
      SupportRequest,
      Invoice,
      Payment,
      Patient,
      Appointment,
      UserSession,
    ]),
  ],
})
export class BackofficeModule {}
