BEGIN;

ALTER TABLE clinic_subscriptions
  ADD COLUMN IF NOT EXISTS "providerCheckoutRequestId" text,
  ADD COLUMN IF NOT EXISTS "providerCheckoutFingerprint" text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_clinic_subscriptions_provider_checkout_request
  ON clinic_subscriptions ("providerCheckoutRequestId")
  WHERE "providerCheckoutRequestId" IS NOT NULL;

COMMIT;
