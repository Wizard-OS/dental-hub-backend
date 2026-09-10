-- Additive migration for patient chart and appointment-type settings.
-- Run against an existing schema before deploying with DB_SYNCHRONIZE=false.
BEGIN;

ALTER TABLE clinical_records
  ADD COLUMN IF NOT EXISTS "bloodType" text,
  ADD COLUMN IF NOT EXISTS "healthInsurance" text,
  ADD COLUMN IF NOT EXISTS "currentMedication" text,
  ADD COLUMN IF NOT EXISTS habits text;

ALTER TABLE appointment_types
  ALTER COLUMN "defaultPrice" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS currency varchar(3) NOT NULL DEFAULT 'UYU';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointments_confirmationstatus_enum') THEN
    CREATE TYPE appointments_confirmationstatus_enum AS ENUM (
      'pending',
      'confirmed',
      'no_response',
      'declined'
    );
  END IF;
END $$;

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS "confirmationStatus" appointments_confirmationstatus_enum NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "confirmationRequestedAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "confirmedAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "lastRescheduledAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "rescheduleCount" integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_appointments_confirmation_status_start
  ON appointments ("clinicId", "confirmationStatus", "startTime");

ALTER TABLE clinical_notes
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS "occurredAt" timestamptz;
UPDATE clinical_notes SET "occurredAt" = "createdAt" WHERE "occurredAt" IS NULL;
ALTER TABLE clinical_notes
  ALTER COLUMN "occurredAt" SET DEFAULT now(),
  ALTER COLUMN "occurredAt" SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clinical_notes_record_occurred
  ON clinical_notes ("clinicalRecordId", "occurredAt" DESC);

CREATE TABLE IF NOT EXISTS patient_exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "patientId" uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text NOT NULL,
  "performedAt" timestamptz NOT NULL,
  description text,
  "clinicalNoteId" uuid REFERENCES clinical_notes(id) ON DELETE SET NULL,
  measurements jsonb NOT NULL DEFAULT '[]'::jsonb,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_patient_exams_patient_performed
  ON patient_exams ("patientId", "performedAt");
CREATE TABLE IF NOT EXISTS patient_exam_files (
  "examId" uuid NOT NULL REFERENCES patient_exams(id) ON DELETE CASCADE,
  "fileId" uuid NOT NULL REFERENCES patient_files(id) ON DELETE CASCADE,
  PRIMARY KEY ("examId", "fileId")
);
CREATE INDEX IF NOT EXISTS idx_patient_exam_files_file ON patient_exam_files ("fileId");
COMMIT;
