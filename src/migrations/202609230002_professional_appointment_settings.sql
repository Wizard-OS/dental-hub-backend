-- Add professional-level appointment settings overrides.
-- Run against an existing schema before deploying with DB_SYNCHRONIZE=false.
BEGIN;

ALTER TABLE clinic_memberships
  ADD COLUMN IF NOT EXISTS "appointmentSettingsJson" jsonb;

COMMIT;
