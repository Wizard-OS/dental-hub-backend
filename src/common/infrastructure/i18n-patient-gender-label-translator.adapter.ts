import { Injectable } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';

import type { PatientGenderLabelTranslator } from '../application/ports/patient-gender-label-translator.port';
import { Gender } from '../interfaces/gender.enum';

@Injectable()
export class I18nPatientGenderLabelTranslatorAdapter implements PatientGenderLabelTranslator {
  constructor(private readonly i18n: I18nService) {}

  translate(value: Gender, language: string): string {
    return String(
      this.i18n.translate(`api.gender.${value}`, { lang: language }),
    );
  }
}
