import assert from 'node:assert/strict';
import test from 'node:test';
import { createDatabaseConnectionConfig } from './database-config.mjs';

test('normalizes legacy TLS modes to full certificate verification', () => {
  const config = createDatabaseConnectionConfig({
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
