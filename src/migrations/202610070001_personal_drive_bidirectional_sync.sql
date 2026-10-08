ALTER TABLE user_storage_integrations
  ADD COLUMN IF NOT EXISTS "driveStartPageToken" text,
  ADD COLUMN IF NOT EXISTS "driveWatchChannelId" text,
  ADD COLUMN IF NOT EXISTS "driveWatchResourceId" text,
  ADD COLUMN IF NOT EXISTS "driveWatchTokenHash" text,
  ADD COLUMN IF NOT EXISTS "driveWatchExpiresAt" timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_storage_drive_watch_channel
  ON user_storage_integrations ("driveWatchChannelId")
  WHERE "driveWatchChannelId" IS NOT NULL;

ALTER TABLE patient_files
  ADD COLUMN IF NOT EXISTS "syncReviewRequired" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "syncReviewReason" text;
