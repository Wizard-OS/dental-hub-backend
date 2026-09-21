-- Phase 3 operational schema (message templates, outbound messages, expenses, reminders upgrades)
-- Idempotent migration for PostgreSQL.

-- 1) Enum types
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_channel_enum') THEN
    CREATE TYPE notification_channel_enum AS ENUM ('email', 'sms', 'whatsapp', 'push_notification');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_template_status_enum') THEN
    CREATE TYPE message_template_status_enum AS ENUM ('active', 'inactive');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'outbound_message_status_enum') THEN
    CREATE TYPE outbound_message_status_enum AS ENUM ('queued', 'sent', 'failed', 'cancelled');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'expense_category_enum') THEN
    CREATE TYPE expense_category_enum AS ENUM ('supplies', 'payroll', 'services', 'rent', 'other');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reminder_status_enum') THEN
    CREATE TYPE reminder_status_enum AS ENUM ('scheduled', 'sent', 'failed', 'cancelled');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reminder_type_enum') THEN
    CREATE TYPE reminder_type_enum AS ENUM ('email', 'sms', 'push_notification');
  END IF;
END $$;

-- 2) message_templates
CREATE TABLE IF NOT EXISTS message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "clinicId" uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  channel notification_channel_enum NOT NULL,
  name text NOT NULL,
  body text NOT NULL,
  status message_template_status_enum NOT NULL DEFAULT 'active',
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_message_templates_clinic
  ON message_templates ("clinicId");

-- 3) outbound_messages
CREATE TABLE IF NOT EXISTS outbound_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "clinicId" uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  "patientId" uuid REFERENCES patients(id) ON DELETE SET NULL,
  "appointmentId" uuid REFERENCES appointments(id) ON DELETE SET NULL,
  "templateId" uuid REFERENCES message_templates(id) ON DELETE SET NULL,
  channel notification_channel_enum NOT NULL,
  "payloadJson" jsonb NOT NULL DEFAULT '{}'::jsonb,
  status outbound_message_status_enum NOT NULL DEFAULT 'queued',
  "providerMessageId" text,
  error text,
  "sentAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outbound_messages_clinic_created
  ON outbound_messages ("clinicId", "createdAt");

CREATE INDEX IF NOT EXISTS idx_outbound_messages_status
  ON outbound_messages (status);

-- 4) expenses
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "clinicId" uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  category expense_category_enum NOT NULL DEFAULT 'other',
  amount numeric(12, 2) NOT NULL,
  "spentAt" timestamptz NOT NULL,
  notes text,
  "recordedByMembershipId" uuid,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_clinic_spent
  ON expenses ("clinicId", "spentAt");

-- 5) reminders upgrades
CREATE TABLE IF NOT EXISTS reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "appointmentId" uuid NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  "templateId" uuid REFERENCES message_templates(id) ON DELETE SET NULL,
  type reminder_type_enum NOT NULL DEFAULT 'email',
  channel notification_channel_enum NOT NULL DEFAULT 'email',
  status reminder_status_enum NOT NULL DEFAULT 'scheduled',
  "scheduledAt" timestamptz NOT NULL DEFAULT now(),
  "sentAt" timestamptz,
  error text
);

CREATE INDEX IF NOT EXISTS idx_reminders_appointment
  ON reminders ("appointmentId");

ALTER TABLE reminders
  ADD COLUMN IF NOT EXISTS "templateId" uuid REFERENCES message_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status reminder_status_enum NOT NULL DEFAULT 'scheduled',
  ADD COLUMN IF NOT EXISTS error text;

-- If channel was text in previous versions, convert it to enum safely
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'reminders'
      AND column_name = 'channel'
      AND udt_name IN ('text', 'varchar')
  ) THEN
    ALTER TABLE reminders
      ALTER COLUMN channel TYPE notification_channel_enum
      USING (
        CASE lower(channel)
          WHEN 'email' THEN 'email'::notification_channel_enum
          WHEN 'sms' THEN 'sms'::notification_channel_enum
          WHEN 'push_notification' THEN 'push_notification'::notification_channel_enum
          WHEN 'whatsapp' THEN 'whatsapp'::notification_channel_enum
          ELSE 'email'::notification_channel_enum
        END
      );
  END IF;
END $$;

-- sentAt should be nullable in upgraded schema
ALTER TABLE reminders
  ALTER COLUMN "sentAt" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reminders_status_scheduled
  ON reminders (status, "scheduledAt");
