import type { Gender } from '../../interfaces/gender.enum';

export const PATIENT_GENDER_LABEL_TRANSLATOR = Symbol(
  'PATIENT_GENDER_LABEL_TRANSLATOR',
);

export interface PatientGenderLabelTranslator {
  translate(value: Gender, language: string): string;
}
