-- Multi-tenant hardening for clinic-scoped MVP.
-- Clinic is the tenant boundary selected by x-clinic-id.

-- 1) Backfill clinicId from already-scoped parent rows where possible.
UPDATE appointments a
SET "clinicId" = p."clinicId"
FROM patients p
WHERE a."patientId" = p.id
  AND a."clinicId" IS NULL
  AND p."clinicId" IS NOT NULL;

UPDATE invoices i
SET "clinicId" = p."clinicId"
FROM patients p
WHERE i."patientId" = p.id
  AND i."clinicId" IS NULL
  AND p."clinicId" IS NOT NULL;

-- If a legacy database has clinics but unscoped patients, put them in the
-- first clinic so the NOT NULL migration is explicit and recoverable.
UPDATE patients
SET "clinicId" = (SELECT id FROM clinics ORDER BY "createdAt" ASC LIMIT 1)
WHERE "clinicId" IS NULL
  AND EXISTS (SELECT 1 FROM clinics);

-- 2) Every active clinic must keep an owner. Promote the oldest admin when
-- legacy data has no owner yet.
WITH clinics_without_owner AS (
  SELECT cm."clinicId", MIN(cm."createdAt") AS first_membership_at
  FROM clinic_memberships cm
  WHERE cm."isActive" = true
  GROUP BY cm."clinicId"
  HAVING COUNT(*) FILTER (WHERE cm.role = 'owner') = 0
),
candidates AS (
  SELECT
    cm.id,
    row_number() OVER (
      PARTITION BY cm."clinicId"
      ORDER BY
        CASE WHEN cm.role = 'admin' THEN 0 ELSE 1 END,
        cm."createdAt" ASC
    ) AS rank
  FROM clinic_memberships cm
  INNER JOIN clinics_without_owner cwo ON cwo."clinicId" = cm."clinicId"
  WHERE cm."isActive" = true
)
UPDATE clinic_memberships cm
SET role = 'owner'
WHERE cm.id IN (SELECT id FROM candidates WHERE rank = 1);

-- 3) Drop old global patient unique constraints on email/phone.
DO $$
DECLARE
  constraint_record record;
BEGIN
  FOR constraint_record IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = current_schema()
      AND t.relname = 'patients'
      AND c.contype = 'u'
      AND (
        ARRAY(
          SELECT a.attname
          FROM unnest(c.conkey) AS key(attnum)
          JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = key.attnum
          ORDER BY a.attnum
        ) = ARRAY['email']
        OR
        ARRAY(
          SELECT a.attname
          FROM unnest(c.conkey) AS key(attnum)
          JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = key.attnum
          ORDER BY a.attnum
        ) = ARRAY['phone']
      )
  LOOP
    EXECUTE format('ALTER TABLE patients DROP CONSTRAINT IF EXISTS %I', constraint_record.conname);
  END LOOP;
END $$;

DROP INDEX IF EXISTS "IDX_patients_email";
DROP INDEX IF EXISTS "IDX_patients_phone";

-- 4) Tenant indexes and uniqueness within clinic.
CREATE INDEX IF NOT EXISTS idx_patients_clinic
  ON patients ("clinicId");

CREATE UNIQUE INDEX IF NOT EXISTS uq_patients_clinic_email
  ON patients ("clinicId", email)
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_patients_clinic_phone
  ON patients ("clinicId", phone)
  WHERE phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_clinic
  ON appointments ("clinicId");

CREATE INDEX IF NOT EXISTS idx_invoices_clinic
  ON invoices ("clinicId");

CREATE INDEX IF NOT EXISTS idx_clinic_memberships_clinic_user_active
  ON clinic_memberships ("clinicId", "userId", "isActive");

-- 5) Enforce required tenant columns only once backfill is complete.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM patients WHERE "clinicId" IS NULL) THEN
    ALTER TABLE patients ALTER COLUMN "clinicId" SET NOT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM appointments WHERE "clinicId" IS NULL) THEN
    ALTER TABLE appointments ALTER COLUMN "clinicId" SET NOT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM invoices WHERE "clinicId" IS NULL) THEN
    ALTER TABLE invoices ALTER COLUMN "clinicId" SET NOT NULL;
  END IF;
END $$;
