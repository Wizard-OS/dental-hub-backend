import type { INestApplication } from '@nestjs/common';
import type { Express } from 'express';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { I18nValidationPipe } from 'nestjs-i18n';

import { I18nHttpExceptionFilter } from '../common/filters/i18n-http-exception.filter';
import { I18nResponseInterceptor } from '../common/interceptors/i18n-response.interceptor';
import { getTrustedProxyHops } from './app-module-options';
import { getEnv } from './env';
import {
  allowedCorsOrigins,
  bodyLimit,
  validateSecurityEnvironment,
} from './security';

// Create applications with bodyParser: false so there is exactly one parser per content type.
export function configureHttp(app: INestApplication, prefix = 'api'): void {
  validateSecurityEnvironment();
  const express = app.getHttpAdapter().getInstance() as Express;

  express.set('trust proxy', getTrustedProxyHops());
  app.setGlobalPrefix(prefix);
  app.use(helmet());
  app.use(json({ limit: bodyLimit('BODY_JSON_LIMIT', '1mb') }));
  app.use(
    urlencoded({
      extended: false,
      limit: bodyLimit('BODY_URLENCODED_LIMIT', '256kb'),
      parameterLimit: 100,
    }),
  );
  const origins = allowedCorsOrigins();

  app.enableCors({
    credentials: true,
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) =>
      callback(
        null,
        !origin ||
          origins.includes(origin) ||
          (origins.length === 0 && getEnv('NODE_ENV') !== 'production'),
      ),
  });
  app.useGlobalPipes(
    new I18nValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      validationError: { target: false, value: false },
    }),
  );
  app.useGlobalFilters(app.get(I18nHttpExceptionFilter));
  app.useGlobalInterceptors(app.get(I18nResponseInterceptor));
}
