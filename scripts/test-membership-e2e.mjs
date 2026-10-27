import { spawnSync } from 'node:child_process';

const result = spawnSync(
  process.execPath,
  [
    'scripts/test-security-e2e.mjs',
    'membership-checkout.e2e-spec.ts',
    'membership.e2e-spec.ts',
  ],
  { stdio: 'inherit', env: process.env },
);
process.exitCode = result.status ?? 1;
