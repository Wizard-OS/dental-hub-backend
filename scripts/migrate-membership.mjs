import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import pg from 'pg';
try {
  process.loadEnvFile();
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const client = new pg.Client(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST ?? '127.0.0.1',
        port: Number(process.env.DB_PORT ?? 5432),
        user: process.env.DB_USERNAME ?? 'postgres',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME ?? 'DentalHubDB',
        ...(process.env.DB_SSL === 'true'
          ? { ssl: { rejectUnauthorized: true } }
          : {}),
      },
);
const migrations = [
  '202609100001_membership_checkout_contracts.sql',
  '202609100002_membership_saved_methods_and_jobs.sql',
];
try {
  await client.connect();
  await client.query('BEGIN');
  await client.query(
    "SELECT pg_advisory_xact_lock(hashtextextended('dentalhub-membership-migrations', 0))",
  );
  await client.query(
    'CREATE TABLE IF NOT EXISTS membership_schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())',
  );
  for (const name of migrations) {
    const sql = await fs.readFile(
      new URL(`../src/migrations/${name}`, import.meta.url),
      'utf8',
    );
    const checksum = createHash('sha256').update(sql).digest('hex');
    const { rows } = await client.query(
      'SELECT checksum FROM membership_schema_migrations WHERE name = $1',
      [name],
    );
    if (rows[0]) {
      if (rows[0].checksum !== checksum)
        throw new Error(`Applied migration changed: ${name}`);
      console.log(`Already applied: ${name}`);
      continue;
    }
    await client.query(sql);
    await client.query(
      'INSERT INTO membership_schema_migrations(name, checksum) VALUES ($1, $2)',
      [name, checksum],
    );
    console.log(`Applied: ${name}`);
  }
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(`Membership migration failed: ${error.code ?? error.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
