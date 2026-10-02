import { Gender } from '../interfaces/gender.enum';
import type { PatientGenderLabelTranslator } from './ports/patient-gender-label-translator.port';
import { GetPatientGenderOptions } from './get-patient-gender-options.use-case';

describe('GetPatientGenderOptions', () => {
  it('returns backend enum values with the requested translations', () => {
    const translator: PatientGenderLabelTranslator = {
      translate: (value, language) => `${language}:${value}`,
    };
    const useCase = new GetPatientGenderOptions(translator);

    expect(useCase.execute('es')).toEqual([
      { value: Gender.MALE, label: 'es:Male' },
      { value: Gender.FEMALE, label: 'es:Female' },
      { value: Gender.NON_BINARY, label: 'es:Non-binary' },
      { value: Gender.OTHER, label: 'es:Other' },
      { value: Gender.PREFER_NOT_TO_SAY, label: 'es:Prefer not to say' },
    ]);
  });
});
