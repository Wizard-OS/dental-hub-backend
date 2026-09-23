-- Performance indexes for the main read paths reviewed on 2026-09-23.
-- Keep this migration idempotent: the SQL runner records checksums and these
-- indexes may also exist in restored/staging databases.

-- Appointments: clinic calendar views, reports, and overlap checks.
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_start
  ON appointments ("clinicId", "startTime");

CREATE INDEX IF NOT EXISTS idx_appointments_clinic_professional_window
  ON appointments ("clinicId", "professionalMembershipId", "startTime", "endTime")
  WHERE "professionalMembershipId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_clinic_dentist_window
  ON appointments ("clinicId", "dentistId", "startTime", "endTime")
  WHERE "dentistId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_type
  ON appointments ("appointmentTypeId")
  WHERE "appointmentTypeId" IS NOT NULL;

-- Invoices and payments: dashboard totals, invoice lists, pending balances,
-- payment status refreshes, and income reports.
CREATE INDEX IF NOT EXISTS idx_invoices_clinic_issued
  ON invoices ("clinicId", "issuedAt" DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_clinic_status_issued
  ON invoices ("clinicId", status, "issuedAt" DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_patient_issued
  ON invoices ("patientId", "issuedAt" DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_treatment
  ON invoices ("treatmentId")
  WHERE "treatmentId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice
  ON invoice_items ("invoiceId");

CREATE INDEX IF NOT EXISTS idx_payments_invoice
  ON payments ("invoiceId");

CREATE INDEX IF NOT EXISTS idx_payments_invoice_active
  ON payments ("invoiceId")
  WHERE "voidedAt" IS NULL;

CREATE INDEX IF NOT EXISTS idx_payments_paid_active
  ON payments ("paidAt" DESC)
  WHERE "voidedAt" IS NULL;

CREATE INDEX IF NOT EXISTS idx_payments_patient_paid
  ON payments ("patientId", "paidAt" DESC)
  WHERE "patientId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_treatment_paid
  ON payments ("treatmentId", "paidAt" DESC)
  WHERE "treatmentId" IS NOT NULL;

-- Patients: tenant-scoped lists and exact lookups already have unique indexes;
-- this adds ordering support and optional trigram acceleration for ILIKE.
CREATE INDEX IF NOT EXISTS idx_patients_clinic_created
  ON patients ("clinicId", "createdAt" DESC);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_available_extensions WHERE name = 'pg_trgm'
  ) THEN
    BEGIN
      EXECUTE 'CREATE EXTENSION IF NOT EXISTS pg_trgm';
    EXCEPTION
      WHEN insufficient_privilege THEN
        NULL;
    END;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_patients_first_name_trgm ON patients USING gin ("firstName" gin_trgm_ops)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_patients_last_name_trgm ON patients USING gin ("lastName" gin_trgm_ops)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_patients_email_trgm ON patients USING gin (email gin_trgm_ops)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_users_first_name_trgm ON users USING gin ("firstName" gin_trgm_ops)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_users_last_name_trgm ON users USING gin ("lastName" gin_trgm_ops)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_users_email_trgm ON users USING gin (email gin_trgm_ops)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_clinics_name_trgm ON clinics USING gin (name gin_trgm_ops)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_clinics_email_trgm ON clinics USING gin (email gin_trgm_ops)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_clinics_phone_trgm ON clinics USING gin (phone gin_trgm_ops)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_support_requests_subject_trgm ON support_requests USING gin (subject gin_trgm_ops)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_support_requests_message_trgm ON support_requests USING gin (message gin_trgm_ops)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_support_requests_contact_email_trgm ON support_requests USING gin ("contactEmail" gin_trgm_ops)';
  END IF;
END $$;

-- Clinical chart, files, and treatments.
CREATE INDEX IF NOT EXISTS idx_clinical_notes_record_occurred_desc
  ON clinical_notes ("clinicalRecordId", "occurredAt" DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_clinical_notes_author_occurred
  ON clinical_notes ("authorMembershipId", "occurredAt" DESC)
  WHERE "authorMembershipId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_patient_files_patient_available_created
  ON patient_files ("patientId", "createdAt" DESC)
  WHERE "deletedAt" IS NULL AND "storageStatus" = 'available';

CREATE INDEX IF NOT EXISTS idx_patient_files_appointment
  ON patient_files ("appointmentId")
  WHERE "appointmentId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_patient_files_clinical_note_available
  ON patient_files ("clinicalNoteId")
  WHERE "clinicalNoteId" IS NOT NULL AND "storageStatus" = 'available';

CREATE INDEX IF NOT EXISTS idx_patient_files_treatment
  ON patient_files ("treatmentId")
  WHERE "treatmentId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_treatments_patient_created
  ON treatments ("patientId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS idx_treatments_patient_active_status
  ON treatments ("patientId", "isActive", status);

CREATE INDEX IF NOT EXISTS idx_treatments_professional_created
  ON treatments ("professionalMembershipId", "createdAt" DESC)
  WHERE "professionalMembershipId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_treatment_sessions_record_performed
  ON treatment_sessions ("clinicalRecordId", "performedAt" DESC);

CREATE INDEX IF NOT EXISTS idx_treatment_sessions_treatment_performed
  ON treatment_sessions ("treatmentId", "performedAt" DESC);

-- Membership/access control and backoffice support views.
CREATE INDEX IF NOT EXISTS idx_clinic_memberships_user_active_created
  ON clinic_memberships ("userId", "isActive", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS idx_clinic_memberships_clinic_role_active
  ON clinic_memberships ("clinicId", role, "isActive");

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_last_active
  ON user_sessions ("userId", "lastActiveAt" DESC);

CREATE INDEX IF NOT EXISTS idx_support_requests_user_created
  ON support_requests ("userId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS idx_support_requests_status_created
  ON support_requests (status, "createdAt" DESC);

CREATE INDEX IF NOT EXISTS idx_support_requests_created
  ON support_requests ("createdAt" DESC);

CREATE INDEX IF NOT EXISTS idx_users_active_created
  ON users ("isActive", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS idx_clinics_active_created
  ON clinics ("isActive", "createdAt" DESC);
