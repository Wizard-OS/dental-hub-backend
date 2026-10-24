import { Gender } from '../interfaces/gender.enum';
import { GetPatientGenderOptions } from './get-patient-gender-options.use-case';
import type { PatientGenderLabelTranslator } from './ports/patient-gender-label-translator.port';

describe('GetPatientGenderOptions', () => {
  it('returns backend enum values with the requested translations', () => {
    const translator: PatientGenderLabelTranslator = {
      translate: (value, language) => `${language}:${value}`,
    };
    const useCase = new GetPatientGenderOptions(translator);

    expect(useCase.execute('es')).toEqual([
      { value: Gender.MALE, label: 'es:Male' },
      { value: Gender.FEMALE, label: 'es:Female' },
      { value: Gender.PREFER_NOT_TO_SAY, label: 'es:Prefer not to say' },
    ]);
  });
});
