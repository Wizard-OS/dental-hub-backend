# Backend Review - 2026-09-23

## Summary

This review focused on high-read backend paths in the NestJS/PostgreSQL API: patients, appointments, clinical chart data, files, invoices, payments, memberships, billing, user sessions, and backoffice support views.

The main implementation change is `src/migrations/202609230001_performance_indexes.sql`, which adds idempotent indexes for observed query patterns without changing public API contracts.

## Findings

### P1 - TypeScript check is blocked by project config

- File: `tsconfig.json`
- Evidence: `pnpm exec tsc --noEmit` fails because `rootDir` is `./src`, but the default TypeScript include pattern also picks up `__test__/*.ts`.
- Impact: A useful static verification command is currently noisy and cannot distinguish real type failures from config drift.
- Recommendation: Add explicit `include`/`exclude` entries, or use a dedicated no-emit config for source-only checks.

### P1 - Schema source of truth can drift outside production

- File: `src/app.module.ts`
- Evidence: `DB_SYNCHRONIZE` defaults to enabled when `NODE_ENV !== 'production'`, while production uses manual SQL migrations through `scripts/migrate-sql.mjs`.
- Impact: Development and test environments can silently create or change tables that are not represented in migrations, hiding deploy-time schema gaps.
- Recommendation: Default `synchronize` to `false` and use migrations locally, or gate synchronize behind an explicit opt-in env var.

### P2 - Payment reads depend on joins without supporting indexes

- Files: `src/payments/payments.service.ts`, `src/common/common.service.ts`
- Evidence: payment lists and income/dashboard reports join payments to invoices and filter by `invoice.clinicId`, `payment.voidedAt`, and `payment.paidAt`.
- Impact: As payment volume grows, dashboard and report queries can degrade because payments have no direct clinic key and previously lacked indexes on active payments and invoice joins.
- Recommendation: Added `idx_payments_invoice`, `idx_payments_invoice_active`, and `idx_payments_paid_active`. Consider denormalizing `clinicId` onto payments only if report volumes outgrow join-based reads.

### P2 - Appointment overlap checks need window-friendly indexes

- File: `src/appointments/appointments.service.ts`
- Evidence: `assertNoOverlap` filters by clinic, time window, status, and either `professionalMembershipId` or `dentistId`.
- Impact: Scheduling can slow down for clinics with large appointment histories.
- Recommendation: Added partial compound indexes for professional and dentist overlap windows. A future improvement would be a PostgreSQL exclusion constraint if overlapping appointments must be impossible under concurrency.

### P2 - Clinical note list currently filters inaccessible patients in memory

- File: `src/clinical-notes/clinical-notes.service.ts`
- Evidence: `findAll` loads clinic notes first, then loops through each note and calls access checks, filtering inaccessible patients in application code.
- Impact: Secondary roles can trigger extra queries and load more rows than they are allowed to see.
- Recommendation: Move patient-access filtering into the SQL query, similar to `PatientAccessService.applyPatientAccessFilter`. This was not changed to keep the current work focused on audit plus indexes.

### P2 - Patient and backoffice search uses leading-wildcard `ILIKE`

- Files: `src/patients/patients.service.ts`, `src/backoffice/backoffice.service.ts`
- Evidence: patient, user, clinic, and support-request search use `%term%`.
- Impact: B-tree indexes do not help these searches.
- Recommendation: The migration attempts to enable `pg_trgm` when available and creates trigram indexes conditionally. If the database user cannot install extensions, enable `pg_trgm` once with an admin role.

### P3 - Several list endpoints do not expose pagination

- Files: `src/appointments/appointments.service.ts`, `src/invoices/invoices.service.ts`, `src/payments/payments.service.ts`, `src/clinical-notes/clinical-notes.service.ts`
- Evidence: multiple `findAll` methods return all clinic rows ordered by date.
- Impact: Indexes help sorting and filtering, but large clinics can still produce heavy responses.
- Recommendation: Add limit/offset or cursor pagination to high-volume endpoints in a separate API-compatible iteration.

## Index Coverage Added

- Appointments: clinic calendar ordering, report date filtering, appointment type joins, professional and dentist overlap checks.
- Billing and finance: invoice lists by clinic/status/date, invoice items, active payments by invoice, and active payment date reports.
- Patients and backoffice search: tenant ordering plus conditional trigram indexes for `%term%` searches.
- Clinical data: notes by record/date, available files by relation, treatments by patient/status, and treatment sessions by record/treatment/date.
- Access/backoffice: clinic memberships by user/role, user sessions by activity, support requests by user/status/date, and active clinic/user backoffice lists.

## Verification Notes

- `pnpm exec tsc --noEmit` was run and failed only on the known `rootDir`/`__test__` config issue.
- The migration is intentionally idempotent with `CREATE INDEX IF NOT EXISTS` and guarded `pg_trgm` setup.
