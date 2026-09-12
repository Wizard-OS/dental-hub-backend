ALTER TABLE clinic_subscriptions
  ADD COLUMN IF NOT EXISTS "billingMode" text NOT NULL DEFAULT 'subscription',
  ADD COLUMN IF NOT EXISTS "checkoutRequestId" uuid,
  ADD COLUMN IF NOT EXISTS "selectedPaymentMethodId" uuid,
  ADD COLUMN IF NOT EXISTS "paymentMethodSummary" jsonb,
  ADD COLUMN IF NOT EXISTS "billingAnchorAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "nextChargeAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "paidCycles" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "recurringConsentAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "recurringConsentMembershipId" uuid,
  ADD COLUMN IF NOT EXISTS "reminderDueAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "reminderSentAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "reminderFirstAttemptAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "reminderNextAttemptAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "reminderAttempts" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "reminderError" text,
  ADD COLUMN IF NOT EXISTS "reminderProviderId" text,
  ADD COLUMN IF NOT EXISTS "reminderMessage" jsonb;

CREATE TABLE IF NOT EXISTS membership_payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "clinicId" uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  "providerTokenId" text NOT NULL UNIQUE,
  "providerCustomerId" text NOT NULL,
  type text NOT NULL CHECK (type IN ('card', 'paypal')),
  brand text, last4 text, expiry text, "maskedEmail" text,
  "isDefault" boolean NOT NULL DEFAULT false,
  "deletedAt" timestamptz,
  "createdAt" timestamp NOT NULL DEFAULT now(), "updatedAt" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_membership_default_method ON membership_payment_methods ("clinicId") WHERE "isDefault" = true AND "deletedAt" IS NULL;
CREATE INDEX IF NOT EXISTS idx_membership_method_clinic ON membership_payment_methods ("clinicId");

CREATE TABLE IF NOT EXISTS membership_setup_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "clinicId" uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  "requestId" uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('card', 'paypal')),
  "providerSetupTokenId" text, "approvedCustomerId" text, "providerPaymentTokenId" text,
  "approvalUrl" text, status text NOT NULL DEFAULT 'created', "paymentMethodId" uuid,
  "expiresAt" timestamptz NOT NULL, "createdAt" timestamp NOT NULL DEFAULT now(),
  UNIQUE ("clinicId", "requestId")
);

CREATE TABLE IF NOT EXISTS membership_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "clinicId" uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  "requestId" uuid NOT NULL, "agreementId" text NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT now(), UNIQUE ("clinicId", "requestId")
);

CREATE TABLE IF NOT EXISTS membership_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "clinicId" uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  "agreementId" text NOT NULL, cycle integer NOT NULL CHECK (cycle >= 0),
  amount integer NOT NULL CHECK (amount > 0), currency text NOT NULL DEFAULT 'USD',
  "dueAt" timestamptz NOT NULL, "periodEnd" timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending', "providerOrderId" text UNIQUE,
  "providerCaptureId" text, "approvalUrl" text, attempts integer NOT NULL DEFAULT 0,
  "firstAttemptAt" timestamptz, "nextAttemptAt" timestamptz, "paidAt" timestamptz, error text,
  "createdAt" timestamp NOT NULL DEFAULT now(), "updatedAt" timestamp NOT NULL DEFAULT now(),
  UNIQUE ("agreementId", cycle)
);
CREATE INDEX IF NOT EXISTS idx_membership_charge_clinic ON membership_charges ("clinicId", "createdAt");
CREATE INDEX IF NOT EXISTS idx_membership_next_charge ON clinic_subscriptions ("nextChargeAt") WHERE "billingMode" = 'vault';
CREATE INDEX IF NOT EXISTS idx_membership_due_reminder ON clinic_subscriptions ("reminderDueAt") WHERE "reminderSentAt" IS NULL;

-- Existing confirmed trials also receive their day-12 reminder after upgrading.
UPDATE clinic_subscriptions SET "reminderDueAt" = "trialEndsAt" - interval '2 days', "reminderNextAttemptAt" = "trialEndsAt" - interval '2 days'
WHERE status = 'trialing' AND "trialEndsAt" > now() AND "reminderDueAt" IS NULL AND "reminderSentAt" IS NULL;
