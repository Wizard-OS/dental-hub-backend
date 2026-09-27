import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { Request } from 'express';

import { ApiMessageTranslatorService } from '../i18n/api-message-translator.service';

@Injectable()
export class I18nResponseInterceptor implements NestInterceptor {
  constructor(private readonly translator: ApiMessageTranslatorService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const lang = this.resolveLang(request);

    return next.handle().pipe(
      map((data) => {
        if (!data) return data;

        if (typeof data === 'string') {
          return this.translator.translate(data, lang);
        }

        if (
          typeof data === 'object' &&
          'message' in (data as Record<string, unknown>)
        ) {
          const payload = data as Record<string, unknown>;
          if (typeof payload.message === 'string') {
            payload.message = this.translator.translate(payload.message, lang);
          }
          return payload;
        }

        return data;
      }),
    );
  }

  private resolveLang(request: Request) {
    const queryLang =
      typeof request.query.lang === 'string' ? request.query.lang : undefined;
    const headerLang =
      typeof request.headers['x-lang'] === 'string'
        ? request.headers['x-lang']
        : undefined;
    const acceptLang =
      typeof request.headers['accept-language'] === 'string'
        ? request.headers['accept-language']
        : undefined;

    return queryLang ?? headerLang ?? acceptLang?.split(',')[0] ?? 'en';
  }
}
