ALTER TABLE billing_webhook_events
  ADD COLUMN IF NOT EXISTS "processingToken" uuid,
  ADD COLUMN IF NOT EXISTS "processingUntil" timestamptz;
