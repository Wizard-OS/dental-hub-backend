import { spawn } from 'node:child_process';
import pg from 'pg';
try {
  process.loadEnvFile();
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const host = process.env.DB_HOST ?? '127.0.0.1';
if (
  !['localhost', '127.0.0.1', '::1'].includes(host) ||
  process.env.DATABASE_URL
)
  throw new Error(
    'Isolated membership tests require a local PostgreSQL configuration without DATABASE_URL',
  );
const name = `dental_membership_test_${Date.now()}`;
const admin = new pg.Client({
  host,
  port: Number(process.env.DB_PORT ?? 5432),
  user: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD,
  database: 'postgres',
});
let created = false;
try {
  await admin.connect();
  await admin.query(`CREATE DATABASE "${name}"`);
  created = true;
  for (const spec of [
    '__test__/membership-checkout.e2e-spec.ts',
    '__test__/membership.e2e-spec.ts',
  ]) {
    const child = spawn(
      'pnpm',
      [
        'exec',
        'jest',
        '--config',
        '__test__/jest-e2e.json',
        '--runInBand',
        '--no-cache',
        spec,
      ],
      {
        stdio: 'inherit',
        env: {
          ...process.env,
          DB_NAME: name,
          DB_SYNCHRONIZE: 'true',
          NODE_ENV: 'test',
          BILLING_WORKER_ENABLED: 'false',
          PAYPAL_CLIENT_ID: '',
          PAYPAL_CLIENT_SECRET: '',
          RESEND_API_KEY: '',
        },
      },
    );
    const code = await new Promise((resolve, reject) => {
      child.on('error', reject);
      child.on('exit', (code) => resolve(code ?? 1));
    });
    if (code !== 0) process.exitCode = code;
  }
} catch (error) {
  console.error(
    `Membership integration tests failed: ${error.code ?? error.message}`,
  );
  process.exitCode = 1;
} finally {
  if (created) await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
  await admin.end();
}
