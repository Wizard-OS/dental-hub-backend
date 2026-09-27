import { PatientExamsModule } from './patient-exams/patient-exams.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';

import { I18nModule } from 'nestjs-i18n';
import * as path from 'path';

import { AppService } from './app.service';
import { AppController } from './app.controller';

import { AuthModule } from './auth/auth.module';
import { SeedModule } from './seed/seed.module';
import { CommonModule } from './common/common.module';
import { ClinicsModule } from './clinics/clinics.module';
import { ExpensesModule } from './expenses/expenses.module';
import { PatientsModule } from './patients/patients.module';
import { InvoicesModule } from './invoices/invoices.module';
import { PaymentsModule } from './payments/payments.module';
import { RemindersModule } from './reminders/reminders.module';
import { TreatmentsModule } from './treatments/treatments.module';
import { HelpCenterModule } from './help-center/help-center.module';
import { OdontogramModule } from './odontogram/odontogram.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { PatientFilesModule } from './patient-files/patient-files.module';
import { UserSessionsModule } from './user-sessions/user-sessions.module';
import { ClinicalNotesModule } from './clinical-notes/clinical-notes.module';
import { PaymentMethodsModule } from './payment-methods/payment-methods.module';
import { ClinicalRecordsModule } from './clinical-records/clinical-records.module';
import { PatientAssignmentsModule } from './patient-assignments/patient-assignments.module';
import { MessageTemplatesModule } from './message-templates/message-templates.module';
import { OutboundMessagesModule } from './outbound-messages/outbound-messages.module';
import { TreatmentSessionsModule } from './treatment-sessions/treatment-sessions.module';
import { ClinicMembershipsModule } from './clinic-memberships/clinic-memberships.module';
import { NotificationPreferencesModule } from './notification-preferences/notification-preferences.module';
import { MembershipModule } from './membership/membership.module';
import { BillingModule } from './billing/billing.module';
import { BackofficeModule } from './backoffice/backoffice.module';
import { ProfessionalSpecialtiesModule } from './professional-specialties/professional-specialties.module';
import {
  createI18nOptions,
  createThrottlerOptions,
  createTypeOrmOptions,
  isSeedEndpointEnabled,
} from './config/app-module-options';

@Module({
  imports: [
    ConfigModule.forRoot(),
    ThrottlerModule.forRoot(createThrottlerOptions()),
    ServeStaticModule.forRoot({
      rootPath: path.join(process.cwd(), 'uploads', 'profile-photos'),
      serveRoot: '/uploads/profile-photos',
      serveStaticOptions: {
        index: false,
      },
      renderPath: '/_index',
    }),
    I18nModule.forRoot(createI18nOptions()),
    TypeOrmModule.forRoot(createTypeOrmOptions()),

    PatientExamsModule,
    CommonModule,
    BackofficeModule,
    ClinicsModule,
    MembershipModule,
    BillingModule,
    ClinicMembershipsModule,
    AuthModule,
    ...(isSeedEndpointEnabled() ? [SeedModule] : []),
    PatientsModule,
    PatientAssignmentsModule,
    AppointmentsModule,
    InvoicesModule,
    PaymentsModule,
    ExpensesModule,
    MessageTemplatesModule,
    OutboundMessagesModule,
    TreatmentsModule,
    ClinicalRecordsModule,
    ClinicalNotesModule,
    TreatmentSessionsModule,
    OdontogramModule,
    PatientFilesModule,
    RemindersModule,
    NotificationPreferencesModule,
    UserSessionsModule,
    PaymentMethodsModule,
    ProfessionalSpecialtiesModule,
    HelpCenterModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
