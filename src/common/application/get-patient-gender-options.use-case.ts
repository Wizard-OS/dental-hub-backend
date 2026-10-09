import { Gender } from '../interfaces/gender.enum';
import type { PatientGenderOption } from '../domain/patient-gender-option';
import type { PatientGenderLabelTranslator } from './ports/patient-gender-label-translator.port';

const availableGenders = [
  Gender.MALE,
  Gender.FEMALE,
  Gender.PREFER_NOT_TO_SAY,
] as const;

export class GetPatientGenderOptions {
  constructor(private readonly translator: PatientGenderLabelTranslator) {}

  execute(language: string): PatientGenderOption[] {
    return availableGenders.map((value) => ({
      value,
      label: this.translator.translate(value, language),
    }));
  }
}
