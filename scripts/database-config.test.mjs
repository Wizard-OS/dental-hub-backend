import assert from 'node:assert/strict';
import test from 'node:test';
import { createDatabaseConnectionConfig } from './database-config.mjs';

test('normalizes legacy TLS modes to full certificate verification', () => {
  const config = createDatabaseConnectionConfig({
    NODE_ENV: 'production',
    DATABASE_URL: 'postgres://user:pass@db.example/app?sslmode=require',
    DB_SSL: 'yes',
  });

  assert.match(config.connectionString, /sslmode=verify-full/);
  assert.deepEqual(config.ssl, { rejectUnauthorized: true });
});

test('rejects insecure or conflicting TLS URL parameters', () => {
  for (const databaseUrl of [
    'postgres://user:pass@db.example/app?sslmode=no-verify',
    'postgres://user:pass@db.example/app?ssl=no-verify',
    'postgres://user:pass@db.example/app?ssl=0',
    'postgres://user:pass@db.example/app?sslmode=verify-full&sslmode=disable',
  ]) {
    assert.throws(
      () =>
        createDatabaseConnectionConfig({
          DATABASE_URL: databaseUrl,
          DB_SSL: '1',
        }),
      /insecure|conflicting|no-verify/,
      databaseUrl,
    );
  }
});

test('keeps local PostgreSQL without TLS supported', () => {
  const config = createDatabaseConnectionConfig({
    DB_HOST: '127.0.0.1',
    DB_SSL: 'false',
  });

  assert.equal(config.host, '127.0.0.1');
  assert.equal('ssl' in config, false);
});

test('requires explicit database credentials in production', () => {
  assert.throws(
    () => createDatabaseConnectionConfig({ NODE_ENV: 'production' }),
    /DB_HOST/,
  );

  const config = createDatabaseConnectionConfig({
    NODE_ENV: 'production',
    DB_HOST: 'db.example',
    DB_NAME: 'dentalhub',
    DB_USERNAME: 'dentalhub_app',
    DB_PASSWORD: 'configured-secret',
    DB_SSL: 'true',
  });

  assert.equal(config.host, 'db.example');
  assert.equal(config.database, 'dentalhub');
  assert.equal(config.user, 'dentalhub_app');
  assert.equal(config.password, 'configured-secret');
});

test('requires verified database TLS in production', () => {
  assert.throws(
    () =>
      createDatabaseConnectionConfig({
        NODE_ENV: 'production',
        DB_HOST: 'db.example',
        DB_NAME: 'dentalhub',
        DB_USERNAME: 'dentalhub_app',
        DB_PASSWORD: 'configured-secret',
      }),
    /require DB_SSL=true/,
  );
});
