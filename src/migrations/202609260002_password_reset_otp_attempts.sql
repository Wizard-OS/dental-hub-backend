ALTER TABLE users
  ADD COLUMN IF NOT EXISTS "passwordResetOtpAttemptCount" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "passwordResetOtpLockedUntil" timestamp;

CREATE INDEX IF NOT EXISTS idx_users_password_reset_otp_locked_until
  ON users ("passwordResetOtpLockedUntil")
  WHERE "passwordResetOtpLockedUntil" IS NOT NULL;
