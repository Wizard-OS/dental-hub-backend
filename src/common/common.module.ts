import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { I18nHttpExceptionFilter } from './filters/i18n-http-exception.filter';
import { I18nResponseInterceptor } from './interceptors/i18n-response.interceptor';
import { ApiMessageTranslatorService } from './i18n/api-message-translator.service';

import { CommonService } from './common.service';
import { CommonController } from './common.controller';
import { CountriesController } from './countries.controller';
import { CountriesService } from './countries.service';
import { GetPatientGenderOptions } from './application/get-patient-gender-options.use-case';
import {
  PATIENT_GENDER_LABEL_TRANSLATOR,
  type PatientGenderLabelTranslator,
} from './application/ports/patient-gender-label-translator.port';
import { I18nPatientGenderLabelTranslatorAdapter } from './infrastructure/i18n-patient-gender-label-translator.adapter';
import { PatientGendersController } from './presentation/patient-genders.controller';
import { Invoice } from '../invoices/entities/invoice.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { Reminder } from '../reminders/entities/reminder.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { Treatment } from '../treatments/entities/treatment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Invoice,
      Payment,
      Appointment,
      Expense,
      Reminder,
      Treatment,
    ]),
  ],
  controllers: [
    CommonController,
    CountriesController,
    PatientGendersController,
  ],
  providers: [
    CommonService,
    CountriesService,
    {
      provide: PATIENT_GENDER_LABEL_TRANSLATOR,
      useClass: I18nPatientGenderLabelTranslatorAdapter,
    },
    {
      provide: GetPatientGenderOptions,
      useFactory: (translator: PatientGenderLabelTranslator) =>
        new GetPatientGenderOptions(translator),
      inject: [PATIENT_GENDER_LABEL_TRANSLATOR],
    },
    ApiMessageTranslatorService,
    I18nHttpExceptionFilter,
    I18nResponseInterceptor,
  ],
  exports: [
    CountriesService,
    ApiMessageTranslatorService,
    I18nHttpExceptionFilter,
    I18nResponseInterceptor,
  ],
})
export class CommonModule {}
