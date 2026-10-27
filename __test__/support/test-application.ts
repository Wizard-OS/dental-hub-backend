import type { INestApplication } from '@nestjs/common';

import { configureHttp } from '../../src/config/configure-http';
import { SeedService } from '../../src/seed/seed.service';

export function configureTestApplication(app: INestApplication): void {
  assertIsolatedDatabase();
  configureHttp(app, '');
}

export async function seedTestDatabase(app: INestApplication) {
  assertIsolatedDatabase();

  return { body: await app.get(SeedService).runSeed() };
}

function assertIsolatedDatabase(): void {
  if (
    process.env.E2E_ISOLATED !== 'true' ||
    !/^dental_security_test_[a-z0-9_]+$/.test(process.env.DB_NAME ?? '') ||
    process.env.DATABASE_URL ||
    process.env.DB_HOST !== '127.0.0.1'
  )
    throw new Error('Refusing to use a non-isolated E2E database.');
}
