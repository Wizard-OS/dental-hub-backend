import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { I18nHttpExceptionFilter } from './common/filters/i18n-http-exception.filter';
import { I18nResponseInterceptor } from './common/interceptors/i18n-response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(app.get(I18nHttpExceptionFilter));
  app.useGlobalInterceptors(app.get(I18nResponseInterceptor));

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
  SwaggerModule.setup('api/docs', app, document);

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  logger.log(`App running on port ${port}`);
  logger.log(`Swagger docs available at http://localhost:${port}/api/docs`);
}
void bootstrap();
