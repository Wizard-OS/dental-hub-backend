import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { ApiMessage } from '../i18n/api-message';
import { ApiMessageTranslatorService } from '../i18n/api-message-translator.service';

@Injectable()
export class I18nResponseInterceptor implements NestInterceptor<
  unknown,
  unknown
> {
  constructor(private readonly translator: ApiMessageTranslatorService) {}

  intercept(
    _context: ExecutionContext,
    next: CallHandler<unknown>,
  ): Observable<unknown> {
    return next.handle().pipe(
      map((data: unknown) => {
        if (data instanceof ApiMessage) return this.translator.translate(data);
        if (
          data &&
          typeof data === 'object' &&
          'message' in data &&
          data.message instanceof ApiMessage
        ) {
          return { ...data, message: this.translator.translate(data.message) };
        }
        return data;
      }),
    );
  }
}
