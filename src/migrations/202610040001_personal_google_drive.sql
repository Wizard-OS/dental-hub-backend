-- Additive migration: old clinic Drive credentials remain valid for legacy reads.
ALTER TABLE users ALTER COLUMN password DROP NOT NULL;
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS "googleSubject" text,
  ADD COLUMN IF NOT EXISTS "googleEmail" text;
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_google_subject ON users ("googleSubject") WHERE "googleSubject" IS NOT NULL;

CREATE TABLE IF NOT EXISTS user_storage_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  "googleSubject" text NOT NULL,
  "googleEmail" text NOT NULL,
  status storage_integration_status_enum NOT NULL DEFAULT 'disconnected',
  "rootFolderId" text,
  "encryptedAccessToken" text,
  "encryptedRefreshToken" text,
  "tokenExpiresAt" timestamptz,
  "metadataJson" jsonb NOT NULL DEFAULT '{}',
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE patient_files
  ADD COLUMN IF NOT EXISTS "uploadedByUserId" uuid,
  ADD COLUMN IF NOT EXISTS "storageIntegrationId" uuid REFERENCES user_storage_integrations(id) ON DELETE RESTRICT;
UPDATE patient_files AS file SET "uploadedByUserId" = membership."userId"
FROM clinic_memberships AS membership WHERE file."uploadedByMembershipId" = membership.id AND file."uploadedByUserId" IS NULL;
CREATE INDEX IF NOT EXISTS idx_patient_files_personal_drive ON patient_files ("uploadedByUserId", "storageIntegrationId");

CREATE TABLE IF NOT EXISTS drive_migration_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "integrationId" uuid NOT NULL REFERENCES user_storage_integrations(id) ON DELETE CASCADE,
  "fileId" uuid NOT NULL REFERENCES patient_files(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'complete', 'failed', 'skipped')),
  error text,
  "leaseUntil" timestamptz,
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("integrationId", "fileId")
);
