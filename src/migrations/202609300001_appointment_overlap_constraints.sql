-- Keep the application-level overlap check for a useful error message, and
-- enforce the invariant in PostgreSQL so concurrent requests cannot race.
-- Existing overlaps are grandfathered so this migration does not cancel or
-- delete appointments already stored in production.
BEGIN;

CREATE OR REPLACE FUNCTION prevent_appointment_overlap()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  check_professional boolean;
  check_dentist boolean;
  advisory_key bigint;
BEGIN
  IF NEW.status = '3' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    check_professional := true;
    check_dentist := true;
  ELSE
    check_professional :=
      NEW."clinicId" IS DISTINCT FROM OLD."clinicId"
      OR NEW."professionalMembershipId" IS DISTINCT FROM OLD."professionalMembershipId"
      OR NEW."startTime" IS DISTINCT FROM OLD."startTime"
      OR NEW."endTime" IS DISTINCT FROM OLD."endTime"
      OR (OLD.status = '3' AND NEW.status <> '3');
    check_dentist :=
      NEW."clinicId" IS DISTINCT FROM OLD."clinicId"
      OR NEW."dentistId" IS DISTINCT FROM OLD."dentistId"
      OR NEW."startTime" IS DISTINCT FROM OLD."startTime"
      OR NEW."endTime" IS DISTINCT FROM OLD."endTime"
      OR (OLD.status = '3' AND NEW.status <> '3');
  END IF;

  IF NOT check_professional AND NOT check_dentist THEN
    RETURN NEW;
  END IF;

  -- Serialize writes for each affected professional/dentist. The volatile
  -- trigger function checks for conflicts after acquiring these locks.
  FOR advisory_key IN
    SELECT hashtextextended(lock_keys.key, 0)
    FROM unnest(
      ARRAY[
        CASE
          WHEN check_professional AND NEW."professionalMembershipId" IS NOT NULL
            THEN 'appointment-professional:' || NEW."clinicId"::text || ':' || NEW."professionalMembershipId"::text
        END,
        CASE
          WHEN check_dentist AND NEW."dentistId" IS NOT NULL
            THEN 'appointment-dentist:' || NEW."clinicId"::text || ':' || NEW."dentistId"::text
        END
      ]
    ) AS lock_keys(key)
    WHERE lock_keys.key IS NOT NULL
    ORDER BY 1
  LOOP
    PERFORM pg_advisory_xact_lock(advisory_key);
  END LOOP;

  IF check_professional
     AND NEW."professionalMembershipId" IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM appointments existing
       WHERE existing.id IS DISTINCT FROM NEW.id
         AND existing."clinicId" = NEW."clinicId"
         AND existing."professionalMembershipId" = NEW."professionalMembershipId"
         AND existing.status <> '3'
         AND tsrange(existing."startTime", existing."endTime", '[)')
             && tsrange(NEW."startTime", NEW."endTime", '[)')
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23P01',
      MESSAGE = 'Appointment overlaps with an existing slot';
  END IF;

  IF check_dentist
     AND NEW."dentistId" IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM appointments existing
       WHERE existing.id IS DISTINCT FROM NEW.id
         AND existing."clinicId" = NEW."clinicId"
         AND existing."dentistId" = NEW."dentistId"
         AND existing.status <> '3'
         AND tsrange(existing."startTime", existing."endTime", '[)')
             && tsrange(NEW."startTime", NEW."endTime", '[)')
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23P01',
      MESSAGE = 'Appointment overlaps with an existing slot';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS appointments_prevent_overlaps ON appointments;
CREATE TRIGGER appointments_prevent_overlaps
BEFORE INSERT OR UPDATE ON appointments
FOR EACH ROW
EXECUTE FUNCTION prevent_appointment_overlap();

COMMIT;
