export const legacyMigrationAliases = {
  '202603040001_clinic_appointments_billing_core.sql': [
    {
      name: '202603040001_phase1_core.sql',
      checksum:
        '825987427e20dfb4f70dcb53122db7dd5e15400d32818e247ebd6f2765bf6174',
      renamedChecksum:
        'db293a8db4a0e8ba86c4aec7f86927462d56ddee247abbce98003d3b9eee905d',
    },
  ],
  '202603050002_messaging_reminders_expenses.sql': [
    {
      name: '202603050002_phase3_ops.sql',
      checksum:
        '38f7f751bc8a7def07138c1137603648169f15f015727873a4990e6b4e0e1aa6',
      renamedChecksum:
        '024713c86b70851964001ea52597658a90650789190ed8ad93f133c1b4017392',
    },
  ],
  '202607090001_patient_clinical_records_billing_files.sql': [
    {
      name: '202607090001_phase1_mvp_gaps.sql',
      checksum:
        '7747f95d2e3dd5c66bc61bcfb96d46f5613e2ca9f91ffde0c300cd6495eb6a41',
      renamedChecksum:
        'd4d1b70d72c49b61f19b4c3254614268858af2b6270b65a04804efabc5715641',
    },
  ],
};

export async function applyMigration(client, migration, legacyAliases = []) {
  const current = await findMigration(client, migration.name);

  if (current) {
    assertChecksum(migration.name, current.checksum, migration.checksum);
    return 'already-applied';
  }

  for (const alias of legacyAliases) {
    assertChecksum(migration.name, migration.checksum, alias.renamedChecksum);
    const legacy = await findMigration(client, alias.name);
    if (!legacy) continue;

    assertChecksum(alias.name, legacy.checksum, alias.checksum);
    await recordMigration(client, migration.name, migration.checksum);
    return 'renamed';
  }

  await client.query(migration.sql);
  await recordMigration(client, migration.name, migration.checksum);
  return 'applied';
}

async function findMigration(client, name) {
  const { rows } = await client.query(
    'SELECT checksum FROM schema_migrations WHERE name = $1',
    [name],
  );

  return rows[0] ?? null;
}

function assertChecksum(name, actual, expected) {
  if (actual !== expected) {
    throw new Error(`Applied migration changed: ${name}`);
  }
}

async function recordMigration(client, name, checksum) {
  await client.query(
    'INSERT INTO schema_migrations(name, checksum) VALUES ($1, $2)',
    [name, checksum],
  );
}
