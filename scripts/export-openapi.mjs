import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
try {
  process.loadEnvFile();
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
process.env.BILLING_WORKER_ENABLED = 'false';
process.env.GOOGLE_DRIVE_SYNC_WORKER_ENABLED = 'false';
process.env.DB_SYNCHRONIZE = 'false';
// OpenAPI discovery only needs DI tokens; keep export independent of a live database.
DataSource.prototype.initialize = function initialize() {
  this.isInitialized = true;
  return Promise.resolve(this);
};
DataSource.prototype.destroy = function destroy() {
  this.isInitialized = false;
  return Promise.resolve();
};
const require = createRequire(import.meta.url);
const { AppModule } = require('../dist/app.module.js');
const app = await NestFactory.create(AppModule, { logger: false });
try {
  app.setGlobalPrefix('api');
  const config = new DocumentBuilder()
    .setTitle('Dental Hub API')
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey(
      { type: 'apiKey', name: 'x-clinic-id', in: 'header' },
      'x-clinic-id',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  await fs.writeFile(
    new URL('../__docs__/openapi.json', import.meta.url),
    JSON.stringify(document, null, 2) + '\n',
  );
  console.log(`Exported ${Object.keys(document.paths).length} API paths`);
} finally {
  await app.close();
}
