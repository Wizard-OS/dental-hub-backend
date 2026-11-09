CREATE TABLE IF NOT EXISTS push_devices (
  token text PRIMARY KEY,
  "userId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform varchar(16) NOT NULL CHECK (platform IN ('android', 'ios')),
  "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "IDX_push_devices_userId"
  ON push_devices ("userId");

CREATE TABLE IF NOT EXISTS user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  "isRead" boolean NOT NULL DEFAULT false,
  "isDismissed" boolean NOT NULL DEFAULT false,
  "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "IDX_user_notifications_userId_createdAt"
  ON user_notifications ("userId", "createdAt" DESC);
