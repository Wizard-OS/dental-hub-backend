import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readdirSync } from 'node:fs';
import pg from 'pg';

const selectedSpecs = process.argv.slice(2);
const availableSpecs = readdirSync('__test__').filter((name) =>
  name.endsWith('.e2e-spec.ts'),
);
if (selectedSpecs.some((name) => !availableSpecs.includes(name)))
  throw new Error('Unknown E2E suite requested.');
const specs = availableSpecs
  .filter((name) => selectedSpecs.length === 0 || selectedSpecs.includes(name))
  .sort();
const suffix = randomBytes(6).toString('hex');
const project = `dental-security-${suffix}`;
const database = `dental_security_test_${suffix}`;
const password = randomBytes(24).toString('hex');
const compose = [
  'compose',
  '-p',
  project,
  '-f',
  'docker-compose.security-test.yaml',
];
const dockerEnv = {
  ...process.env,
  SECURITY_TEST_DB: database,
  SECURITY_TEST_PASSWORD: password,
};
function docker(args) {
  const result = spawnSync('docker', [...compose, ...args], {
    env: dockerEnv,
    encoding: 'utf8',
  });
  if (result.status !== 0)
    throw new Error(result.stderr || 'Docker command failed');
  return result.stdout.trim();
}
try {
  docker(['up', '-d', '--wait']);
  const binding = docker(['port', 'db', '5432']);
  const port = Number(binding.split(':').at(-1));
  const environment = {
    ...process.env,
    NODE_ENV: 'test',
    E2E_ISOLATED: 'true',
    DATABASE_URL: '',
    DB_HOST: '127.0.0.1',
    DB_PORT: String(port),
    DB_NAME: database,
    DB_USERNAME: 'postgres',
    DB_PASSWORD: password,
    DB_SSL: 'false',
    DB_SYNCHRONIZE: 'true',
    JWT_SECRET: randomBytes(48).toString('hex'),
    ENABLE_SEED_ENDPOINT: 'true',
    ENABLE_DEV_OTP: 'false',
    THROTTLE_LIMIT: '100000',
    BILLING_WORKER_ENABLED: 'false',
    GOOGLE_DRIVE_SYNC_WORKER_ENABLED: 'false',
    PAYPAL_CLIENT_ID: '',
    PAYPAL_CLIENT_SECRET: '',
    RESEND_API_KEY: '',
    REST_COUNTRIES_API_KEY: '',
    INTEGRATION_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
  };
  // Each suite gets fresh tables; serial runs prevent shared-seed and test pollution.
  for (const spec of specs) {
    const client = new pg.Client({
      host: '127.0.0.1',
      port,
      database,
      user: 'postgres',
      password,
    });
    await client.connect();
    await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
    await client.end();
    const result = spawnSync(
      'pnpm',
      ['test:e2e', '--runInBand', '--runTestsByPath', `__test__/${spec}`],
      { env: environment, stdio: 'inherit' },
    );
    if (result.status !== 0) {
      process.exitCode = 1;
    }
  }
} finally {
  try {
    docker(['down', '-v']);
  } catch {
    console.error(
      `Could not clean disposable Docker project ${project}; retry docker compose -p ${project} -f docker-compose.security-test.yaml down -v when Docker is available.`,
    );
    process.exitCode = 1;
  }
}
