import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';
import { applyMigration, legacyMigrationAliases } from './migration-ledger.mjs';

try {
  process.loadEnvFile();
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, '../src/migrations');
const migrationsTable = 'schema_migrations';
const lockKey = 'dentalhub-schema-migrations';

function clientConfig() {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL };
  }

  return {
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME ?? 'DentalHubDB',
    ...(process.env.DB_SSL === 'true'
      ? { ssl: { rejectUnauthorized: true } }
      : {}),
  };
}

async function listMigrationFiles() {
  const entries = await fs.readdir(migrationsDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

async function readMigration(name) {
  const sql = await fs.readFile(path.join(migrationsDir, name), 'utf8');
  const checksum = createHash('sha256').update(sql).digest('hex');

  return { sql, checksum };
}

const client = new pg.Client(clientConfig());

try {
  await client.connect();
  await client.query('SELECT pg_advisory_lock(hashtextextended($1, 0))', [
    lockKey,
  ]);
  await client.query(
    `CREATE TABLE IF NOT EXISTS ${migrationsTable} (
      name text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`,
  );

  const migrationFiles = await listMigrationFiles();

  for (const name of migrationFiles) {
    const { sql, checksum } = await readMigration(name);
    const result = await applyMigration(
      client,
      { name, sql, checksum },
      legacyMigrationAliases[name],
    );

    if (result === 'already-applied') {
      console.log(`Already applied: ${name}`);
    } else if (result === 'renamed') {
      console.log(`Recognized legacy migration: ${name}`);
    } else {
      console.log(`Applied: ${name}`);
    }
  }

  console.log('SQL migrations complete');
} catch (error) {
  console.error(`SQL migration failed: ${error.code ?? 'unknown'}`);
  if (error.message) console.error(error.message);
  if (error.detail) console.error(`Detail: ${error.detail}`);
  if (error.hint) console.error(`Hint: ${error.hint}`);
  if (error.position) console.error(`Position: ${error.position}`);
  process.exitCode = 1;
} finally {
  await client
    .query('SELECT pg_advisory_unlock(hashtextextended($1, 0))', [lockKey])
    .catch(() => {});
  await client.end().catch(() => {});
}
