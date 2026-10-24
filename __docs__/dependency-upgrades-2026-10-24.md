# Dependency upgrade results — 2026-10-24

Implemented 19 of the 26 upgrade candidates identified on October 23. Seven
dependencies remain deferred to preserve existing behavior or tooling compatibility.
Existing unrelated working-tree changes and API documentation were preserved.

## Applied upgrades

| Dependency | Before | After |
| --- | --- | --- |
| @nestjs/config | 12.0.0 | 12.0.1 |
| @nestjs/jwt | 12.0.2 | 12.0.3 |
| @nestjs/swagger | 12.0.1 | 12.0.3 |
| @nestjs/typeorm | 12.0.1 | 12.0.2 |
| express | 5.2.1 | 5.3.0 |
| google-auth-library | 11.1.0 | 11.3.1 |
| multer | 2.4.0 | 2.5.0 |
| pg | 8.23.0 | 8.23.1 |
| typeorm | 1.1.1 | 1.1.2 |
| @nestjs/cli | 12.0.3 | 12.0.10 |
| @nestjs/schematics | 12.0.4 | 12.0.10 |
| @types/multer | 2.2.0 | 2.3.0 |
| eslint | 10.11.0 | 10.13.0 |
| eslint-plugin-prettier | 5.5.6 | 5.5.7 |
| globals | 17.12.0 | 17.13.0 |
| prettier | 3.9.8 | 3.9.10 |
| supertest | 7.2.2 | 7.3.1 |
| ts-jest | 29.4.12 | 29.4.15 |
| typescript-eslint | 8.70.1 | 8.72.0 |

## Deferred upgrades

- `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, and
  `@nestjs/testing` remain at 12.0.4, now pinned exactly. Testing 12.2.0 revealed
  an observable validation change: an empty array submitted to a DTO with only
  optional fields previously passed validation and now returns 400. A new HTTP
  regression test captures the existing response contract. Adopting the stricter
  validation requires a deliberate API behavior change. See the
  [NestJS 12.2 release notes](https://github.com/nestjs/nest/releases/tag/v12.2.0).
- `typescript` remains at 6.0.3. Version 7 is outside the current peer ranges of
  typescript-eslint, ts-jest, and the Swagger compiler integration.
- `googleapis` remains at 181.0.0. The upgrade to 188 requires separate review of
  the intervening major versions and the Drive integration.
- `@types/node` remains at 26.6.2. Aligning Node types with the supported runtime
  remains separate work; this upgrade did not change the existing type contract.

## Compatibility measures

- `.node-version` selects Node 24.15.0, which was used for verification.
- `packageManager` pins pnpm 12.4.2, matching the existing dependency store.
- The two-document lockfile is intentional pnpm 12 format: the first document
  locks the package manager/environment, and the last locks application
  dependencies. The initial assessment incorrectly called this corruption;
  removing the first document is not a repair. The native format is retained and
  passes a frozen offline install. See
  [pnpm lockfile documentation](https://github.com/pnpm/pnpm/blob/main/pnpm/docs/lockfile.md).
- Scoped overrides ensure Nest's internal Express and Multer dependencies use
  5.3.0 and 2.5.0, respectively. Upgrading only the direct dependencies would have
  left Nest's pinned older dependencies in use. Existing overrides are retained.
- Upload fields retain the previous maximum accepted size of 1,048,575 bytes.
  Multer 2.5 changed its field-size limit to be inclusive, so the upload helper
  explicitly sets that limit. File-size boundaries and rejection statuses remain
  unchanged. Seven new upload tests cover accepted sizes, oversized-file cleanup,
  MIME rejection, and multipart field boundaries.

## Verification

All checks below used Node 24.15.0 and pnpm 12.4.2:

| Check | Result |
| --- | --- |
| Production build (`pnpm build`) | Passed |
| ESLint error checks | Passed |
| Formatting checks on touched code/configuration | Passed |
| Unit and HTTP tests (`pnpm test --runInBand`) | 35 suites, 206 tests passed |
| Database configuration, migration ledger, mocked Drive tests | 42 tests passed |
| Frozen offline install | Passed |
| Generated OpenAPI comparison | All 131 paths and schemas structurally unchanged |
| Postman check using checked-in OpenAPI as source | Passed |
| Compiled application startup | Passed; root response and protected-route rejection verified |
| PostgreSQL smoke checks | Passed; initialization, seed, bcrypt/JWT login, clinic/patient persistence, transaction rollback, localized validation, and session revocation |
| Existing full E2E suite | Same 49 failing and 9 passing tests before and after; no new failing cases |

Database checks used a disposable PostgreSQL 14.3 container on an isolated local
port. No existing database was used. Drive checks used mocks; live Google OAuth
and Drive access were not exercised.

The existing E2E failures prevent claiming a fully green integration suite.
Most suites fail during setup because they call the protected seed endpoint
without authentication. The root test also expects an outdated response without
the application's global response interceptor. These tests were left unchanged;
failure names and counts were compared with the pre-upgrade run.

The database smoke check emits a pg deprecation warning about concurrent queries
on a client, but passes. No pg 9 upgrade is included.

### Reproducing the repository checks

Use Node 24.15.0 and pnpm 12.4.2:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm exec eslint "{src,apps,libs,test}/**/*.ts" --quiet
pnpm test --runInBand
pnpm test:database-config
pnpm test:migrations
pnpm test:google-drive
pnpm postman:check --source __docs__/openapi.json
```

Run database E2E tests only against an isolated database with disposable data.
The pre-existing failures described above are still expected.

## Local PostgreSQL upgrade: 14.3 → 18.6

The local Compose service now runs `postgres:18.6`, using
`./postgres-18:/var/lib/postgresql`. Credentials, database name, loopback port
binding, restart policy, and health check are unchanged. External databases were
not accessed or modified.

The previous database container was stopped and referenced an earlier checkout
path. A cold copy of the current repository's PostgreSQL 14 directory was started
in an isolated container to take the backup. SHA256 inventories confirm that the
original `./postgres` files remained unchanged throughout the upgrade.

The retained private backup directory is `.tmp/postgres-upgrade-20261024/`:

- `database.dump`: custom-format application database archive.
- `globals.sql`: global-role backup, including original password settings.
- `schema-compatibility.sql`: original public-schema ownership and grants.
- `docker-compose.pg14.yaml`: pre-upgrade Compose configuration for rollback.
- `baseline.json`, `validation18.json`, `final18.json`, `recreated18.json`:
  preservation inventories before and after restore/recreation.
- `source14-files.json` and `backup-sha256.json`: source file and backup checksums.
- E2E logs and the temporary migration/verification helpers used for this run.

The directory is private (`0700`); dump and role files have permissions `0600`.
It is ignored by Git. Retain it and the original data directory until the upgrade
has been accepted; they are local backup artifacts, not a substitute for an
independent backup.

### Restoration details

The backup was first restored into a disposable PostgreSQL 18.6 instance, then
into the new Compose instance. Both restores completed without errors and
preserved all 27 application tables and 29 rows, including three patients and
three users. Table content hashes and row counts, sequence values, column types,
nullability and defaults, extensions, indexes, constraints, triggers, ownership,
grants, roles, and database properties match the source inventory.

Two catalog/storage differences were normalized during comparison: PostgreSQL 18
records `NOT NULL` constraints in `pg_constraint`, and dump/restore compacts gaps
left by previously dropped columns. Logical column order and nullability were
compared separately. PostgreSQL 18's default public-schema ownership/grants also
differ from 14; the original settings were explicitly restored rather than
accepting the new defaults.

The bootstrap role already existed on the target. Only its duplicate `CREATE
ROLE` statement was omitted; its original attributes/password and remaining role
statements were restored. The freshly initialized, verified-empty application
database was removed before restoring the archive with `--create`.

### PostgreSQL 18 verification

| Check | Result |
| --- | --- |
| Source-to-disposable restore comparison | Passed |
| Source-to-final Compose database comparison | Passed |
| Forced Compose container recreation and repeat comparison | Passed |
| Final Compose health check | Healthy |
| Production build | Passed |
| Compiled API startup against preserved database | Passed with synchronization and workers disabled |
| Protected HTTP route without credentials | 401 as expected |
| Successful login, patient HTTP reads, session revocation | Passed on a separate disposable application schema |
| ORM transaction rollback | Passed on the disposable schema |
| Appointment overlap trigger | Conflicting insert rejected with SQLSTATE 23P01; non-overlapping insert accepted inside a rolled-back transaction |
| Existing database E2E suite on PostgreSQL 18 | Same 49 failing and nine passing tests; all failing test names match the PostgreSQL 14 baseline |
| Original PostgreSQL 14 directory hashes | Unchanged |
| Saved rollback configuration | Verified image 14.3 and original bind mount |

No application migrations or schema synchronization ran against the preserved
database. Its schema predates the current application: it has no
`schema_migrations` ledger or appointment-overlap trigger and lacks newer
application tables/columns. Their absence is preserved. Full authenticated
application flows were validated on the disposable schema, not claimed to work
against that older preserved schema. Bringing the old database schema current
requires a separate migration review.

The temporary source and validation database containers were removed after
verification. The final local `dental_hub_db` service remains running on 18.6.
Rollback commands and the restriction on rollback after new writes are documented
in the README.
