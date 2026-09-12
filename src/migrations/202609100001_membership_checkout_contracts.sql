ALTER TABLE clinic_subscriptions
  ADD COLUMN IF NOT EXISTS "checkoutQuote" jsonb,
  ADD COLUMN IF NOT EXISTS "trialStartedAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "trialEndsAt" timestamptz;
