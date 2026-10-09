import type { I18nService } from 'nestjs-i18n';

import { Gender } from '../interfaces/gender.enum';
import { I18nPatientGenderLabelTranslatorAdapter } from './i18n-patient-gender-label-translator.adapter';

jest.mock('@nestjs/common', () => ({
  Injectable: () => (target: { prototype: unknown }) => target,
}));
jest.mock('nestjs-i18n', () => ({
  I18nService: class I18nService {},
}));

describe('I18nPatientGenderLabelTranslatorAdapter', () => {
  it('resolves gender labels from the API translation namespace', () => {
    const translations: Record<string, string> = {
      'api.gender.Male': 'Hombre',
      'api.gender.Female': 'Mujer',
      'api.gender.Prefer not to say': 'Prefiere no decir',
    };
    const translate = jest.fn((key: string) => translations[key] ?? key);
    const adapter = new I18nPatientGenderLabelTranslatorAdapter({
      translate,
    } as unknown as I18nService);

    const labels = [Gender.MALE, Gender.FEMALE, Gender.PREFER_NOT_TO_SAY].map(
      (gender) => adapter.translate(gender, 'es'),
    );

    expect(labels).toEqual(['Hombre', 'Mujer', 'Prefiere no decir']);
    expect(translate).toHaveBeenNthCalledWith(1, 'api.gender.Male', {
      lang: 'es',
    });
    expect(translate).toHaveBeenNthCalledWith(2, 'api.gender.Female', {
      lang: 'es',
    });
    expect(translate).toHaveBeenNthCalledWith(
      3,
      'api.gender.Prefer not to say',
      {
        lang: 'es',
      },
    );
  });
});
