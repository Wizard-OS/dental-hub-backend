// Run before importing AppModule: TypeORM synchronization must never see a real database.
if (
  process.env.E2E_ISOLATED !== 'true' ||
  !/^dental_security_test_[a-z0-9_]+$/.test(process.env.DB_NAME ?? '') ||
  process.env.DATABASE_URL ||
  process.env.DB_HOST !== '127.0.0.1'
) {
  throw new Error(
    'E2E tests require a disposable database: pnpm test:e2e:isolated',
  );
}
