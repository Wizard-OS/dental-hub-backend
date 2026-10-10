import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { I18nValidationPipe } from 'nestjs-i18n';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import type { Express } from 'express';

import { AppModule } from './app.module';
import { I18nHttpExceptionFilter } from './common/filters/i18n-http-exception.filter';
import { I18nResponseInterceptor } from './common/interceptors/i18n-response.interceptor';
import { getBooleanEnv, getEnv } from './config/env';
import { getTrustedProxyHops } from './config/app-module-options';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  const expressInstance = app.getHttpAdapter().getInstance() as Express;
  expressInstance.set('trust proxy', getTrustedProxyHops());
  app.setGlobalPrefix('api');
  app.use(helmet());
  app.use(json({ limit: getEnv('BODY_JSON_LIMIT') ?? '1mb' }));
  app.use(
    urlencoded({
      extended: true,
      limit: getEnv('BODY_URLENCODED_LIMIT') ?? '256kb',
    }),
  );
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  app.useGlobalPipes(
    new I18nValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(app.get(I18nHttpExceptionFilter));
  app.useGlobalInterceptors(app.get(I18nResponseInterceptor));

  const port = Number(process.env.PORT ?? 3000);
  if (isSwaggerEnabled()) {
    const config = new DocumentBuilder()
      .setTitle('Dental Hub API')
      .setDescription(
        'API backend para gestión clínica dental — multi-clínica, agenda, facturación, historia clínica, tratamientos, mensajería y más.',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .addApiKey(
        { type: 'apiKey', name: 'x-clinic-id', in: 'header' },
        'x-clinic-id',
      )
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: false,
      },
    });
    logger.log(`Swagger docs available at http://localhost:${port}/api/docs`);
  }

  await app.listen(port);
  logger.log(`App running on port ${port}`);
}
void bootstrap();

function corsOrigin(
  origin: string | undefined,
  callback: (error: Error | null, allow?: boolean) => void,
) {
  if (!origin) return callback(null, true);

  const allowedOrigins = (getEnv('CORS_ORIGINS') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (allowedOrigins.includes(origin)) return callback(null, true);
  if (allowedOrigins.length === 0 && getEnv('NODE_ENV') !== 'production') {
    return callback(null, true);
  }

  return callback(null, false);
}

function isSwaggerEnabled() {
  return getBooleanEnv('ENABLE_SWAGGER') || getEnv('NODE_ENV') !== 'production';
}
