import { Injectable } from '@nestjs/common';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { ApiMessage } from './api-message';

@Injectable()
export class ApiMessageTranslatorService {
  constructor(private readonly i18n: I18nService) {}

  translate(message: ApiMessage, lang?: string): string {
    return String(
      this.i18n.t(message.key, {
        lang: lang ?? I18nContext.current()?.lang ?? 'en',
        args: message.args,
      }),
    );
  }
}
