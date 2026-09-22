-- Phase 1 MVP gaps: richer clinic/patient data, odontogram, patient files,
-- structured clinical notes, treatment status, estimate statuses and voidable payments.

ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS "logoUrl" text,
  ADD COLUMN IF NOT EXISTS "workingHoursJson" jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS "documentId" text,
  ADD COLUMN IF NOT EXISTS "emergencyContact" text,
  ADD COLUMN IF NOT EXISTS observations text,
  ADD COLUMN IF NOT EXISTS "medicalHistory" text,
  ADD COLUMN IF NOT EXISTS "dentalHistory" text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_patients_clinic_document
  ON patients ("clinicId", "documentId")
  WHERE "documentId" IS NOT NULL;

ALTER TABLE clinical_records
  ADD COLUMN IF NOT EXISTS "medicalHistory" text,
  ADD COLUMN IF NOT EXISTS "dentalHistory" text,
  ADD COLUMN IF NOT EXISTS observations text;

ALTER TABLE clinical_notes
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS diagnosis text,
  ADD COLUMN IF NOT EXISTS procedure text,
  ADD COLUMN IF NOT EXISTS indications text,
  ADD COLUMN IF NOT EXISTS observations text,
  ADD COLUMN IF NOT EXISTS "toothCodes" text[] NOT NULL DEFAULT ARRAY[]::text[];

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'treatments_status_enum') THEN
    CREATE TYPE treatments_status_enum AS ENUM (
      'proposed',
      'accepted',
      'in_progress',
      'completed',
      'cancelled'
    );
  END IF;
END $$;

ALTER TABLE treatments
  ADD COLUMN IF NOT EXISTS "professionalMembershipId" uuid REFERENCES clinic_memberships(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "toothCode" text,
  ADD COLUMN IF NOT EXISTS status treatments_status_enum NOT NULL DEFAULT 'proposed',
  ADD COLUMN IF NOT EXISTS "invoiceId" uuid REFERENCES invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "createdAt" timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "updatedAt" timestamptz NOT NULL DEFAULT now();

DO $$
DECLARE
  label text;
BEGIN
  FOREACH label IN ARRAY ARRAY['draft', 'sent', 'accepted', 'rejected', 'expired']
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'invoices_status_enum'
        AND e.enumlabel = label
    ) THEN
      EXECUTE format('ALTER TYPE invoices_status_enum ADD VALUE %L', label);
    END IF;
  END LOOP;
EXCEPTION
  WHEN undefined_object THEN
    NULL;
END $$;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS "treatmentId" uuid REFERENCES treatments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS observations text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payments_method_enum') THEN
    CREATE TYPE payments_method_enum AS ENUM (
      'cash',
      'transfer',
      'manual_card',
      'other'
    );
  END IF;
END $$;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS "patientId" uuid REFERENCES patients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "treatmentId" uuid REFERENCES treatments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "voidedAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "voidReason" text;

UPDATE payments p
SET "patientId" = i."patientId",
    "treatmentId" = i."treatmentId"
FROM invoices i
WHERE p."invoiceId" = i.id
  AND p."patientId" IS NULL;

ALTER TABLE payments
  ALTER COLUMN method TYPE payments_method_enum
  USING (
    CASE
      WHEN method::text = 'card' THEN 'manual_card'
      WHEN method::text = 'cash' THEN 'cash'
      WHEN method::text = 'transfer' THEN 'transfer'
      WHEN method::text = 'manual_card' THEN 'manual_card'
      ELSE 'other'
    END
  )::payments_method_enum;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'odontogram_entries_status_enum') THEN
    CREATE TYPE odontogram_entries_status_enum AS ENUM (
      'healthy',
      'caries',
      'missing',
      'restored',
      'endodontics',
      'crown',
      'implant',
      'extraction_indicated',
      'observation'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS odontogram_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "patientId" uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  "toothCode" text NOT NULL,
  status odontogram_entries_status_enum NOT NULL DEFAULT 'healthy',
  observation text,
  "professionalMembershipId" uuid REFERENCES clinic_memberships(id) ON DELETE SET NULL,
  "clinicalNoteId" uuid REFERENCES clinical_notes(id) ON DELETE SET NULL,
  "treatmentId" uuid REFERENCES treatments(id) ON DELETE SET NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_odontogram_patient_tooth UNIQUE ("patientId", "toothCode")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'patient_files_type_enum') THEN
    CREATE TYPE patient_files_type_enum AS ENUM (
      'image',
      'radiography',
      'pdf',
      'document',
      'other'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS patient_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "patientId" uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  "appointmentId" uuid REFERENCES appointments(id) ON DELETE SET NULL,
  "clinicalNoteId" uuid REFERENCES clinical_notes(id) ON DELETE SET NULL,
  "treatmentId" uuid REFERENCES treatments(id) ON DELETE SET NULL,
  "uploadedByMembershipId" uuid REFERENCES clinic_memberships(id) ON DELETE SET NULL,
  type patient_files_type_enum NOT NULL DEFAULT 'other',
  "originalName" text NOT NULL,
  "storedName" text NOT NULL,
  path text NOT NULL,
  url text NOT NULL,
  "mimeType" text NOT NULL,
  size integer NOT NULL,
  description text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "deletedAt" timestamptz
);

CREATE INDEX IF NOT EXISTS idx_patient_files_patient_created
  ON patient_files ("patientId", "createdAt");
