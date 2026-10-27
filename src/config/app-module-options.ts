import * as fs from 'fs';
import * as path from 'path';

import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import {
  AcceptLanguageResolver,
  HeaderResolver,
  I18nJsonLoader,
  QueryResolver,
} from 'nestjs-i18n';

import {
  getBooleanEnv,
  getEnv,
  getRequiredEnv,
  normalizeDatabaseUrl,
} from './env';
import { positiveIntegerEnv } from './security';

export function isSeedEndpointEnabled(): boolean {
  if (
    getEnv('NODE_ENV') === 'production' &&
    getBooleanEnv('ENABLE_SEED_ENDPOINT')
  )
    throw new Error('Seed endpoints are forbidden in production.');

  return getBooleanEnv('ENABLE_SEED_ENDPOINT');
}

export function createThrottlerOptions() {
  return [
    {
      ttl: positiveIntegerEnv('THROTTLE_TTL_MS', 60_000),
      limit: positiveIntegerEnv('THROTTLE_LIMIT', 120),
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
  const isProduction = getEnv('NODE_ENV') === 'production';
  const rawDatabaseUrl = getEnv('DATABASE_URL');
  const databaseUrl = rawDatabaseUrl
    ? normalizeDatabaseUrl(rawDatabaseUrl, getBooleanEnv('DB_SSL'))
    : undefined;
  const ssl = getBooleanEnv('DB_SSL')
    ? { rejectUnauthorized: true }
    : undefined;
  const databaseUrlUsesVerifiedTls =
    databaseUrl &&
    new URL(databaseUrl).searchParams
      .getAll('sslmode')
      .some((mode) => mode.toLowerCase() === 'verify-full');

  if (isProduction && !databaseUrl) {
    getRequiredEnv('DB_HOST');
    getRequiredEnv('DB_NAME');
    getRequiredEnv('DB_USERNAME');
    getRequiredEnv('DB_PASSWORD');
  }

  if (isProduction && !ssl && !databaseUrlUsesVerifiedTls) {
    throw new Error(
      'Production database connections require DB_SSL=true or DATABASE_URL with sslmode=verify-full.',
    );
  }

  const synchronize =
    getEnv('NODE_ENV') !== 'production' && getEnv('DB_SYNCHRONIZE') === 'true';

  return {
    type: 'postgres',
    ...(databaseUrl
      ? { url: databaseUrl }
      : {
          host: isProduction
            ? getRequiredEnv('DB_HOST')
            : getEnv('DB_HOST') || '127.0.0.1',
          port: positiveIntegerEnv('DB_PORT', 5432, 65535),
          database: isProduction
            ? getRequiredEnv('DB_NAME')
            : getEnv('DB_NAME') || 'DentalHubDB',
          username: isProduction
            ? getRequiredEnv('DB_USERNAME')
            : getEnv('DB_USERNAME') || 'postgres',
          password: isProduction
            ? getRequiredEnv('DB_PASSWORD')
            : getEnv('DB_PASSWORD') || 'postgres',
        }),
    ...(ssl ? { ssl } : {}),
    autoLoadEntities: true,
    synchronize,
    retryAttempts: 10,
    retryDelay: 3000,
  };
}

export function getTrustedProxyHops(): number {
  const value = Number(getEnv('TRUST_PROXY_HOPS') ?? 0);

  if (!Number.isInteger(value) || value < 0 || value > 5) {
    throw new Error('TRUST_PROXY_HOPS must be an integer from 0 to 5.');
  }

  return value;
}
