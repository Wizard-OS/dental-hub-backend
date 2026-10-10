import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { applyMigration, legacyMigrationAliases } from './migration-ledger.mjs';

function createClient(applied = new Map()) {
  const executedSql = [];
  return {
    applied,
    executedSql,
    async query(statement, parameters = []) {
      if (statement.startsWith('SELECT checksum')) {
        const [name] = parameters;
        const checksum = applied.get(name);
        return { rows: checksum ? [{ checksum }] : [] };
      }

      if (statement.startsWith('INSERT INTO schema_migrations')) {
        const [name, checksum] = parameters;
        applied.set(name, checksum);
        return { rows: [] };
      }

      executedSql.push(statement);
      return { rows: [] };
    },
  };
}

const migration = {
  name: '202603040001_clinic_appointments_billing_core.sql',
  sql: 'CREATE TABLE clinic_workflows (id uuid PRIMARY KEY);',
};
const [legacyMigration] = legacyMigrationAliases[migration.name];
migration.checksum = legacyMigration.renamedChecksum;

test('applies a renamed migration on a fresh database', async () => {
  const client = createClient();

  const result = await applyMigration(client, migration, [legacyMigration]);

  assert.equal(result, 'applied');
  assert.deepEqual(client.executedSql, [migration.sql]);
  assert.equal(client.applied.get(migration.name), migration.checksum);
});

test('recognizes a valid legacy record and records the renamed migration without replaying SQL', async () => {
  const client = createClient(
    new Map([[legacyMigration.name, legacyMigration.checksum]]),
  );

  const result = await applyMigration(client, migration, [legacyMigration]);

  assert.equal(result, 'renamed');
  assert.deepEqual(client.executedSql, []);
  assert.equal(client.applied.get(migration.name), migration.checksum);
});

test('rejects a legacy migration record with an unexpected checksum', async () => {
  const client = createClient(new Map([[legacyMigration.name, 'incorrect']]));

  await assert.rejects(
    applyMigration(client, migration, [legacyMigration]),
    new RegExp(`Applied migration changed: ${legacyMigration.name}`),
  );
  assert.deepEqual(client.executedSql, []);
  assert.equal(client.applied.has(migration.name), false);
});

test('does not apply a renamed migration again on subsequent runs', async () => {
  const client = createClient();

  assert.equal(
    await applyMigration(client, migration, [legacyMigration]),
    'applied',
  );
  assert.equal(
    await applyMigration(client, migration, [legacyMigration]),
    'already-applied',
  );

  assert.deepEqual(client.executedSql, [migration.sql]);
});

test('rejects edits to a migration after it has been recorded', async () => {
  const client = createClient(new Map([[migration.name, 'incorrect']]));

  await assert.rejects(
    applyMigration(client, migration, [legacyMigration]),
    new RegExp(`Applied migration changed: ${migration.name}`),
  );
  assert.deepEqual(client.executedSql, []);
});

test('keeps renamed migration checksums aligned with their SQL files', async () => {
  for (const [name, aliases] of Object.entries(legacyMigrationAliases)) {
    const sql = await readFile(
      new URL(`../src/migrations/${name}`, import.meta.url),
    );
    const checksum = createHash('sha256').update(sql).digest('hex');

    assert.equal(aliases.length, 1);
    assert.equal(aliases[0].renamedChecksum, checksum, name);
  }
});
