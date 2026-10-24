CREATE TABLE IF NOT EXISTS clinic_google_drive_oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "clinicId" uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  "userId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "redirectUri" text NOT NULL,
  "stateHash" text NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  "consumedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_clinic_google_drive_oauth_states_state_hash
  ON clinic_google_drive_oauth_states ("stateHash");

CREATE INDEX IF NOT EXISTS idx_clinic_google_drive_oauth_states_expiry
  ON clinic_google_drive_oauth_states ("expiresAt");
