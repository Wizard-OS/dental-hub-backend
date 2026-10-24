import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Appointment } from '../appointments/entities/appointment.entity';
import { AppointmentType } from '../appointments/entities/appointment-type.entity';
import { AuthModule } from '../auth/auth.module';
import { User } from '../auth/entities/user.entity';
import { ClinicMembership } from '../clinic-memberships/entities/clinic-membership.entity';
import { Clinic } from '../clinics/entities/clinic.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { InvoiceItem } from '../invoices/entities/invoice-item.entity';
import { OdontogramEntry } from '../odontogram/entities/odontogram-entry.entity';
import { PatientFile } from '../patient-files/entities/patient-file.entity';
import { Patient } from '../patients/entities/patient.entity';
import { Payment } from '../payments/entities/payment.entity';
import { SeedController } from './seed.controller';
import { SeedService } from './seed.service';

@Module({
  controllers: [SeedController],
  providers: [SeedService],
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      User,
      Clinic,
      ClinicMembership,
      Patient,
      Appointment,
      AppointmentType,
      Invoice,
      InvoiceItem,
      Payment,
      OdontogramEntry,
      PatientFile,
    ]),
  ],
})
export class SeedModule {}
