import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Appointment } from '../appointments/entities/appointment.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Reminder } from '../reminders/entities/reminder.entity';
import { Treatment } from '../treatments/entities/treatment.entity';
import { GetPatientGenderOptions } from './application/get-patient-gender-options.use-case';
import {
  PATIENT_GENDER_LABEL_TRANSLATOR,
  type PatientGenderLabelTranslator,
} from './application/ports/patient-gender-label-translator.port';
import { CommonController } from './common.controller';
import { CommonService } from './common.service';
import { CountriesController } from './countries.controller';
import { CountriesService } from './countries.service';
import { I18nHttpExceptionFilter } from './filters/i18n-http-exception.filter';
import { ApiMessageTranslatorService } from './i18n/api-message-translator.service';
import { I18nPatientGenderLabelTranslatorAdapter } from './infrastructure/i18n-patient-gender-label-translator.adapter';
import { I18nResponseInterceptor } from './interceptors/i18n-response.interceptor';
import { PatientGendersController } from './presentation/patient-genders.controller';

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
