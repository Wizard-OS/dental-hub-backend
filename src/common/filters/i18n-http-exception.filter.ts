import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { ApiMessageTranslatorService } from '../i18n/api-message-translator.service';

@Catch(HttpException)
export class I18nHttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly translator: ApiMessageTranslatorService) {}

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();
    const lang = this.resolveLang(request);

    if (typeof exceptionResponse === 'string') {
      response.status(status).json({
        statusCode: status,
        message: this.translator.translate(exceptionResponse, lang),
      });
      return;
    }

    const payload = exceptionResponse as Record<string, unknown>;

    if (Array.isArray(payload.message)) {
      payload.message = payload.message.map((m) =>
        typeof m === 'string' ? this.translator.translate(m, lang) : m,
      );
    } else if (typeof payload.message === 'string') {
      payload.message = this.translator.translate(payload.message, lang);
    }

    response.status(status).json(payload);
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
