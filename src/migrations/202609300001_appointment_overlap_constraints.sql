-- Keep the application-level overlap check for a useful error message, and
-- enforce the invariant in PostgreSQL so concurrent requests cannot race.
BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM appointments a
    JOIN appointments b
      ON a.id < b.id
     AND a."clinicId" = b."clinicId"
     AND a."professionalMembershipId" = b."professionalMembershipId"
     AND tsrange(a."startTime", a."endTime", '[)')
         && tsrange(b."startTime", b."endTime", '[)')
    WHERE a."professionalMembershipId" IS NOT NULL
      AND a.status <> '3'
      AND b.status <> '3'
  ) THEN
    RAISE EXCEPTION 'Cannot add appointment overlap constraint: active professional appointments overlap';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM appointments a
    JOIN appointments b
      ON a.id < b.id
     AND a."clinicId" = b."clinicId"
     AND a."dentistId" = b."dentistId"
     AND tsrange(a."startTime", a."endTime", '[)')
         && tsrange(b."startTime", b."endTime", '[)')
    WHERE a."dentistId" IS NOT NULL
      AND a.status <> '3'
      AND b.status <> '3'
  ) THEN
    RAISE EXCEPTION 'Cannot add appointment overlap constraint: active dentist appointments overlap';
  END IF;
END $$;

ALTER TABLE appointments
  ADD CONSTRAINT appointments_no_professional_overlap
  EXCLUDE USING gist (
    "clinicId" WITH =,
    "professionalMembershipId" WITH =,
    tsrange("startTime", "endTime", '[)') WITH &&
  )
  WHERE ("professionalMembershipId" IS NOT NULL AND status <> '3');

ALTER TABLE appointments
  ADD CONSTRAINT appointments_no_dentist_overlap
  EXCLUDE USING gist (
    "clinicId" WITH =,
    "dentistId" WITH =,
    tsrange("startTime", "endTime", '[)') WITH &&
  )
  WHERE ("dentistId" IS NOT NULL AND status <> '3');

COMMIT;
