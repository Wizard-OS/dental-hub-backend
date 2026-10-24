import { Injectable } from '@nestjs/common';
import { I18nContext, I18nService } from 'nestjs-i18n';

@Injectable()
export class GenderTranslationService {
  constructor(private readonly i18nService: I18nService) {}

  /**
   * Traduce un valor de género según el idioma solicitado
   * @param genderValue - El valor del género a traducir (ej: "Male", "Female")
   * @param lang - El código de idioma opcional (ej: "es", "en")
   * @returns El género traducido
   */
  translateGender(genderValue: string, lang?: string): string {
    try {
      // Si no se proporciona idioma, intentar obtenerlo del contexto
      const language = lang || I18nContext.current()?.lang || 'es';

      const translation = this.i18nService.translate(`gender.${genderValue}`, {
        lang: language,
      });

      return String(translation);
    } catch {
      // Si la traducción no existe, retornar el valor original
      return genderValue;
    }
  }
}
