-- Core clinic, appointment, and billing schema for the mobile MVP.
-- Run with psql or your migration runner before disabling DB synchronize.

CREATE TABLE IF NOT EXISTS clinics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  timezone text NOT NULL DEFAULT 'America/Montevideo',
  currency text NOT NULL DEFAULT 'USD',
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clinic_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "clinicId" uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  "userId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'odontologist',
  "permissionsJson" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_clinic_membership UNIQUE ("clinicId", "userId")
);

CREATE TABLE IF NOT EXISTS appointment_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "clinicId" uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name text NOT NULL,
  "durationMin" integer NOT NULL,
  "defaultPrice" numeric(12, 2) NOT NULL,
  color text NOT NULL DEFAULT '#1f7a8c',
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "invoiceId" uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'custom',
  "refId" uuid,
  description text NOT NULL,
  qty integer NOT NULL DEFAULT 1,
  "unitPrice" numeric(12, 2) NOT NULL,
  "lineTotal" numeric(12, 2) NOT NULL
);

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS "clinicId" uuid REFERENCES clinics(id) ON DELETE CASCADE;

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS "clinicId" uuid REFERENCES clinics(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS "professionalMembershipId" uuid REFERENCES clinic_memberships(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "appointmentTypeId" uuid REFERENCES appointment_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "createdByMembershipId" uuid,
  ADD COLUMN IF NOT EXISTS "cancelReason" text,
  ADD COLUMN IF NOT EXISTS "updatedAt" timestamptz NOT NULL DEFAULT now();

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS "clinicId" uuid REFERENCES clinics(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS number text,
  ADD COLUMN IF NOT EXISTS subtotal numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "dueAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "updatedAt" timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_clinic_number
  ON invoices ("clinicId", number);

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS reference text,
  ADD COLUMN IF NOT EXISTS "receivedByMembershipId" uuid,
  ADD COLUMN IF NOT EXISTS "createdAt" timestamptz NOT NULL DEFAULT now();

ALTER TABLE clinical_notes
  ADD COLUMN IF NOT EXISTS "authorMembershipId" uuid REFERENCES clinic_memberships(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_professional_start
  ON appointments ("professionalMembershipId", "startTime");

CREATE INDEX IF NOT EXISTS idx_appointments_patient_start
  ON appointments ("patientId", "startTime");

CREATE INDEX IF NOT EXISTS idx_appointments_clinic_status_start
  ON appointments ("clinicId", status, "startTime");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'invoices_status_enum'
      AND e.enumlabel = 'partially_paid'
  ) THEN
    ALTER TYPE invoices_status_enum ADD VALUE 'partially_paid';
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    NULL;
END $$;
