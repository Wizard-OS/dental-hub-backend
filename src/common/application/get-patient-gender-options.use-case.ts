import { Gender } from '../interfaces/gender.enum';
import type { PatientGenderOption } from '../domain/patient-gender-option';
import type { PatientGenderLabelTranslator } from './ports/patient-gender-label-translator.port';

export class GetPatientGenderOptions {
  constructor(private readonly translator: PatientGenderLabelTranslator) {}

  execute(language: string): PatientGenderOption[] {
    return (Object.values(Gender) as Gender[]).map((value) => ({
      value,
      label: this.translator.translate(value, language),
    }));
  }
}
