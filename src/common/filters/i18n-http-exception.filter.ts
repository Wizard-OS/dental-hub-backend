import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  I18nContext,
  I18nService,
  I18nValidationException,
  I18nValidationError,
} from 'nestjs-i18n';
import type { Response } from 'express';
import {
  ApiMessage,
  apiMessage,
  type ApiMessageKey,
} from '../i18n/api-message';
import { ApiMessageTranslatorService } from '../i18n/api-message-translator.service';

@Catch()
export class I18nHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(I18nHttpExceptionFilter.name);

  constructor(
    private readonly translator: ApiMessageTranslatorService,
    private readonly i18n: I18nService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const lang =
      I18nContext.current(host)?.lang ?? I18nContext.current()?.lang ?? 'en';
    if (exception instanceof I18nValidationException) {
      response.status(exception.getStatus()).json({
        statusCode: exception.getStatus(),
        message: this.validationMessages(
          exception.errors,
          lang,
          exception.errorsAlreadyTranslated,
        ),
        error: exception.getResponse(),
      });
      return;
    }
    if (!(exception instanceof HttpException)) {
      this.logger.error(
        exception instanceof Error ? exception.stack : 'Unhandled API error',
      );
      response
        .status(500)
        .json({ statusCode: 500, message: this.statusMessage(500, lang) });
      return;
    }
    const status = exception.getStatus();
    const body = exception.getResponse();
    if (body instanceof ApiMessage) {
      response.status(status).json({
        statusCode: status,
        message: this.translator.translate(body, lang),
        error: this.statusLabel(status),
      });
      return;
    }
    if (typeof body === 'string') {
      response.status(status).json({
        statusCode: status,
        message: this.statusMessage(status, lang),
      });
      return;
    }
    const payload = body as Record<string, unknown>;
    response.status(status).json({
      ...payload,
      message:
        payload.message instanceof ApiMessage
          ? this.translator.translate(payload.message, lang)
          : this.statusMessage(status, lang),
    });
  }

  private validationMessages(
    errors: I18nValidationError[],
    lang: string,
    translated: boolean,
    parent = '',
  ): string[] {
    return errors.flatMap((error) => {
      const path = parent ? `${parent}.${error.property}` : error.property;
      const messages = Object.entries(error.constraints ?? {}).map(
        ([constraint, message]) => {
          // These constraints originate in class-validator itself, without a DTO decorator.
          if (
            constraint === 'whitelistValidation' ||
            constraint === 'unknownValue'
          ) {
            return String(
              this.i18n.t(`validation.${constraint}`, {
                lang,
                args: { property: path },
              }),
            );
          }
          if (translated) return parent ? `${parent}.${message}` : message;
          const separator = message.indexOf('|');
          const key = separator < 0 ? message : message.slice(0, separator);
          const args =
            separator < 0
              ? {}
              : (JSON.parse(message.slice(separator + 1)) as Record<
                  string,
                  unknown
                >);
          const text = String(
            this.i18n.t(key, {
              lang,
              args: { property: error.property, ...args },
            }),
          );
          return parent ? `${parent}.${text}` : text;
        },
      );
      return [
        ...messages,
        ...this.validationMessages(
          error.children ?? [],
          lang,
          translated,
          path,
        ),
      ];
    });
  }

  private statusMessage(status: number, lang: string): string {
    const supported = [
      400, 401, 403, 404, 405, 409, 413, 415, 422, 429, 500, 502, 503, 504,
    ];
    const code = supported.includes(status)
      ? status
      : status >= 500
        ? 500
        : 400;
    return this.translator.translate(
      apiMessage(`api.http.${code}` as ApiMessageKey),
      lang,
    );
  }

  private statusLabel(status: number): string {
    return (HttpStatus[status] ?? 'ERROR')
      .toLowerCase()
      .split('_')
      .map((word) => word[0].toUpperCase() + word.slice(1))
      .join(' ');
  }
}
