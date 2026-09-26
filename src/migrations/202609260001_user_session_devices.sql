CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "deviceName" text,
  "deviceType" text,
  "browserName" text,
  "osName" text,
  "ipAddress" text,
  "userAgent" text,
  "lastActiveAt" timestamptz NOT NULL DEFAULT now(),
  "isRevoked" boolean NOT NULL DEFAULT false,
  "revokedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_sessions
  ADD COLUMN IF NOT EXISTS "deviceName" text,
  ADD COLUMN IF NOT EXISTS "deviceType" text,
  ADD COLUMN IF NOT EXISTS "browserName" text,
  ADD COLUMN IF NOT EXISTS "osName" text,
  ADD COLUMN IF NOT EXISTS "ipAddress" text,
  ADD COLUMN IF NOT EXISTS "userAgent" text,
  ADD COLUMN IF NOT EXISTS "lastActiveAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "isRevoked" boolean,
  ADD COLUMN IF NOT EXISTS "revokedAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "createdAt" timestamptz;

UPDATE user_sessions
SET
  "lastActiveAt" = COALESCE("lastActiveAt", now()),
  "isRevoked" = COALESCE("isRevoked", false),
  "createdAt" = COALESCE("createdAt", now());

ALTER TABLE user_sessions
  ALTER COLUMN "lastActiveAt" SET DEFAULT now(),
  ALTER COLUMN "lastActiveAt" SET NOT NULL,
  ALTER COLUMN "isRevoked" SET DEFAULT false,
  ALTER COLUMN "isRevoked" SET NOT NULL,
  ALTER COLUMN "createdAt" SET DEFAULT now(),
  ALTER COLUMN "createdAt" SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_revoked_last_active
  ON user_sessions ("userId", "isRevoked", "lastActiveAt" DESC);
