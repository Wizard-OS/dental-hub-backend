import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import {
  AcceptLanguageResolver,
  HeaderResolver,
  I18nJsonLoader,
  QueryResolver,
} from 'nestjs-i18n';
import * as fs from 'fs';
import * as path from 'path';

import { getBooleanEnv, getEnv, normalizeDatabaseUrl } from './env';

export function isSeedEndpointEnabled(): boolean {
  return getBooleanEnv('ENABLE_SEED_ENDPOINT');
}

export function createThrottlerOptions() {
  return [
    {
      ttl: numberEnv('THROTTLE_TTL_MS', 60_000),
      limit: numberEnv('THROTTLE_LIMIT', 120),
    },
  ];
}

export function createI18nOptions() {
  const distI18nPath = path.join(__dirname, '..', 'i18n');
  const srcI18nPath = path.join(process.cwd(), 'src/i18n');
  const i18nPath = fs.existsSync(distI18nPath) ? distI18nPath : srcI18nPath;

  return {
    fallbackLanguage: 'en',
    fallbacks: { 'en-*': 'en', 'es-*': 'es' },
    loader: I18nJsonLoader,
    loaderOptions: {
      path: i18nPath,
      watch: getEnv('NODE_ENV') === 'development',
    },
    resolvers: [
      { use: QueryResolver, options: ['lang'] },
      new HeaderResolver(['x-lang', 'x-custom-lang']),
      AcceptLanguageResolver,
    ],
  };
}

export function createTypeOrmOptions(): TypeOrmModuleOptions {
  const rawDatabaseUrl = getEnv('DATABASE_URL');
  const databaseUrl = rawDatabaseUrl
    ? normalizeDatabaseUrl(rawDatabaseUrl)
    : undefined;
  const ssl = getBooleanEnv('DB_SSL')
    ? { rejectUnauthorized: false }
    : undefined;
  const synchronize =
    getEnv('NODE_ENV') !== 'production' && getEnv('DB_SYNCHRONIZE') === 'true';

  return {
    type: 'postgres',
    ...(databaseUrl
      ? { url: databaseUrl }
      : {
          host: getEnv('DB_HOST') || '127.0.0.1',
          port: +(getEnv('DB_PORT') || 5432),
          database: getEnv('DB_NAME') || 'DentalHubDB',
          username: getEnv('DB_USERNAME') || 'postgres',
          password: getEnv('DB_PASSWORD') || 'postgres',
        }),
    ...(ssl ? { ssl } : {}),
    autoLoadEntities: true,
    synchronize,
    retryAttempts: 10,
    retryDelay: 3000,
  };
}

function numberEnv(name: string, fallback: number): number {
  const value = Number(getEnv(name));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
