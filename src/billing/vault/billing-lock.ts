import { DataSource, EntityManager } from 'typeorm';

// A session lock spans durable checkpoints around provider requests. A transaction
// alone would roll back the order ID on a later network failure.
export async function withBillingLock<T>(
  dataSource: DataSource,
  clinicId: string,
  action: (manager: EntityManager) => Promise<T>,
): Promise<T> {
  const runner = dataSource.createQueryRunner();
  await runner.connect();
  const key = `membership-checkout:${clinicId}`;
  try {
    await runner.query('SELECT pg_advisory_lock(hashtextextended($1, 0))', [
      key,
    ]);
    return await action(runner.manager);
  } finally {
    try {
      await runner.query('SELECT pg_advisory_unlock(hashtextextended($1, 0))', [
        key,
      ]);
    } finally {
      await runner.release();
    }
  }
}
