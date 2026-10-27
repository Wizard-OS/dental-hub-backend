import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { getTrustedProxyHops } from './config/app-module-options';
import { configureHttp } from './config/configure-http';
import { getBooleanEnv, getEnv } from './config/env';
import { validateSecurityEnvironment } from './config/security';

async function bootstrap() {
  validateSecurityEnvironment();
  getTrustedProxyHops();
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const logger = new Logger('Bootstrap');

  configureHttp(app);

  const port = Number(process.env.PORT ?? 3000);

  if (isSwaggerEnabled()) {
    const config = new DocumentBuilder()
      .setTitle('Dental Hub API')
      .setDescription(
        'API backend para gestión clínica dental — multi-clínica, agenda, facturación, historia clínica, tratamientos, mensajería y más.',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .addSecurityRequirements('bearer')
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

function isSwaggerEnabled() {
  return getEnv('ENABLE_SWAGGER') === undefined
    ? getEnv('NODE_ENV') !== 'production'
    : getBooleanEnv('ENABLE_SWAGGER');
}
