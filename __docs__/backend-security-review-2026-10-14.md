# Backend Security Review — 2026-10-14

## Scope and limits

Reviewed API route protection and validation, authentication and password recovery, clinic and patient access boundaries, uploads and downloads, PayPal webhooks, Google Drive OAuth and storage, database configuration and migrations, error handling, dependencies, and deployment configuration. This is a repository review based on source, tests, and configuration. It does not verify production infrastructure, proxy behavior, deployed environment variables, provider dashboards, or live exploitability; no live penetration test was performed.

## Prioritized findings

### High (P1) — Google Drive OAuth callback did not validate an unpredictable one-time state

- **Affected code:** `src/storage/google-drive-integration.service.ts`, `src/storage/google-drive-integration.controller.ts`, `src/storage/dto/google-drive-oauth-callback.dto.ts`.
- **Evidence:** The original authorization URL used the clinic ID as OAuth `state`, and the callback exchanged the supplied authorization code without checking that state. A clinic ID is not a secret or a one-time CSRF token.
- **Impact:** An attacker could attempt to make an authenticated clinic administrator connect the attacker's Google Drive account to the victim clinic, potentially redirecting clinic file storage or sync access.
- **Confidence:** High; the missing state check was directly visible in the callback flow.
- **Remedy/status:** Fixed. The API now creates a cryptographically random state, stores only its SHA-256 hash with clinic, user, redirect URI, and a ten-minute expiry, and atomically consumes it once before exchanging the code. The callback now requires `state`. Migration: `src/migrations/202610140002_google_drive_oauth_state.sql`.
- **Compatibility:** The frontend must return the `state` received in the Google OAuth redirect when it calls the backend callback endpoint.

### High (P1) — PayPal webhook de-duplication was vulnerable to concurrent delivery and changing transmission IDs

- **Affected code:** `src/billing/billing-webhook.service.ts`, `src/billing/entities/billing-webhook-event.entity.ts`.
- **Evidence:** The original handler performed a read-then-save check before reconciliation, so concurrent retries could both process the same event. It also fell back to the transmission ID when the signed event lacked an event ID; transmission IDs identify deliveries and can change on retry.
- **Impact:** Replayed or concurrent deliveries could repeat membership renewal or subscription reconciliation work and leave event history inconsistent.
- **Confidence:** High; both behaviors were directly visible in the handler.
- **Remedy/status:** Fixed. The handler requires the provider event ID and atomically claims it with a processing lease, acknowledging completed duplicates and returning a retryable response while another worker owns the lease. Failed claims are released or expire. Migration: `src/migrations/202610140001_billing_webhook_processing_lease.sql`.

### High (P1) — Production database connections could silently use plaintext transport

- **Affected code:** `src/config/app-module-options.ts`, `scripts/database-config.mjs`.
- **Evidence:** `DB_SSL` defaulted to false, and production did not require either that flag or a verified TLS mode in `DATABASE_URL`.
- **Impact:** A production deployment missing TLS configuration could send database credentials and clinical or billing data over an unencrypted network connection.
- **Confidence:** High for the configuration path; whether a particular deployment is exposed depends on its network and environment.
- **Remedy/status:** Fixed. Production now requires `DB_SSL=true` or a `DATABASE_URL` normalized to `sslmode=verify-full`. Insecure and conflicting TLS modes continue to fail.

### High (P1) — Production database settings could fall back to local/default credentials

- **Affected code:** `src/config/app-module-options.ts`, `scripts/database-config.mjs`.
- **Evidence:** Without `DATABASE_URL`, the application previously defaulted to localhost and the `postgres` username/password/database in production.
- **Impact:** Misconfigured releases could start against an unintended database or use a predictable database credential if a local PostgreSQL service were reachable.
- **Confidence:** High; the fallback was explicit in the configuration.
- **Remedy/status:** Fixed. Production requires explicit `DB_HOST`, `DB_NAME`, `DB_USERNAME`, and `DB_PASSWORD` when `DATABASE_URL` is absent. Local defaults remain available outside production.

### Medium (P2) — File URLs trusted the incoming `Host` header

- **Affected code:** `src/common/http/request-url.ts`; used by profile-photo and patient-file upload controllers.
- **Evidence:** The original helper built persisted URLs directly from `request.protocol` and `request.get('host')`.
- **Impact:** If the application or proxy accepts a caller-supplied host, an authenticated upload could persist an attacker-controlled URL for a profile or patient file. Clients may then display or request content from that host.
- **Confidence:** High for the URL construction; exploitability depends on proxy host validation and client handling.
- **Remedy/status:** Fixed. Configured `HOST_API` is now the source of the public host. Production falls back to same-origin relative URLs instead of trusting the request host; development retains the request-derived fallback.

### Medium (P2) — Weak integration-token encryption secrets were accepted

- **Affected code:** `src/storage/token-encryption.service.ts`.
- **Evidence:** Arbitrarily short configured secrets were accepted and hashed into an AES key. The integration ciphertext is authenticated, but a weak source secret makes offline key guessing practical if both the database and ciphertext are exposed.
- **Impact:** Google Drive access tokens could be recovered, allowing access to connected files within the OAuth grant.
- **Confidence:** High for weak secrets being accepted; actual exploitability depends on the deployed secret and whether ciphertext is obtained.
- **Remedy/status:** Fixed for minimum size and missing configuration: keys shorter than 32 bytes now fail, and an absent key is reported as a server configuration error. Generate a random key with `openssl rand -hex 32` and keep it stable so existing tokens remain decryptable. Length alone cannot establish randomness; secret quality remains an operator responsibility.

### Medium (P2) — Local PostgreSQL was published on every host interface

- **Affected code:** `docker-compose.yaml`.
- **Evidence:** The original port mapping exposed PostgreSQL on the host's default interfaces while the Compose file supplied development fallback credentials.
- **Impact:** On a machine reachable by other hosts, the development database could be reachable over the network.
- **Confidence:** High for the Compose mapping; reachability depends on host firewall and network placement.
- **Remedy/status:** Fixed. The host port is now bound to `127.0.0.1`.

### Medium (P2) — Database exceptions were printed without sanitization

- **Affected code:** `src/auth/auth.service.ts`, `src/patients/patients.service.ts`.
- **Evidence:** Error objects were sent directly to `console.log` in database error handlers.
- **Impact:** ORM/driver exceptions can contain SQL details, submitted values, or other sensitive diagnostic context in application logs.
- **Confidence:** High; raw error logging was explicit.
- **Remedy/status:** Fixed. These handlers now log only a database error code or `unknown`, while returning the existing generic server error response.

## Lower-priority recommendations

- **Paginate high-volume lists.** Appointment, invoice, payment, and clinic-wide clinical-note list methods currently load all matching rows. Add bounded pagination (or date-window requirements for schedules) to limit memory use and response size as clinics grow. The patient list already has pagination.
- **Move clinical-note access filtering into SQL.** `ClinicalNotesService.findAll` first loads all notes for a clinic, then checks patient assignment one note at a time and catches every error as if the note were inaccessible. This creates extra queries and can silently return partial results during access-check failures. Express assignment access in the query and allow unexpected database errors to propagate.
- **Use shared rate limiting when running multiple replicas.** `ThrottlerGuard` uses the configured Nest throttler defaults. The code does not configure a shared store, so limits may be per process. If deployed across replicas, enforce limits at a shared gateway or use a shared rate-limit store, especially for login and password recovery.
- **Keep schema synchronization disabled.** `DB_SYNCHRONIZE` is opt-in and production disables it, which is the safer default. Continue applying the checked-in SQL migrations in deployment; do not enable synchronization on shared or persistent environments.
- **Review database and upload infrastructure settings at deployment.** This review cannot verify secret-manager access controls, database network policy/backups, upload-directory persistence and permissions, proxy host validation, or that the new SQL migrations are applied before application rollout.

## Controls reviewed without a confirmed defect

- Authenticated routes use JWT-backed active sessions; clinic-scoped routes resolve an active membership from the authenticated user and `x-clinic-id`, then apply role/permission guards.
- Patient and patient-file access paths reviewed scope lookups to the clinic and check patient assignment/access before returning file contents. No cross-clinic data exposure was confirmed in the reviewed paths.
- Global DTO validation rejects unknown fields. Upload routes enforce size limits, and uploaded files are checked by content signatures before storage. Patient-file downloads require clinic and patient authorization and set `Cache-Control: private, no-store`.
- Password reset codes are random, stored as password hashes, expire, have bounded verification attempts, and are consumed during a locked account update that revokes sessions.
- PayPal webhook requests are verified with the provider before reconciliation. Google Drive change notifications use a random channel token and a stored hash.
- `pnpm audit --prod` reported no known vulnerable production dependencies at review time. This does not establish that all transitive or future dependency versions are risk-free.

## Verification and rollout

Focused security/configuration tests, migration-ledger tests, the Nest build, ESLint on changed TypeScript files, and the generated Postman collection check passed. The full Jest suite passed 33 suites and 193 tests during this review; focused tests were rerun after the final URL and database-TLS changes.

Apply both new SQL migrations before deploying the application. Update the OAuth callback client to send the returned `state`. Production must set either `DB_SSL=true` or a verified TLS `DATABASE_URL`; configure `HOST_API` to the canonical public API URL to return absolute file URLs, otherwise production responses use same-origin relative URLs.
