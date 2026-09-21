-- Add professional specialties catalog and extended profile fields.
-- Idempotent migration for PostgreSQL.
BEGIN;

CREATE TABLE IF NOT EXISTS professional_specialties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

INSERT INTO professional_specialties (code, name, "isActive")
VALUES
  ('odontologia_general', 'Odontología general', true),
  ('ortodoncia', 'Ortodoncia', true),
  ('endodoncia', 'Endodoncia', true),
  ('periodoncia', 'Periodoncia', true),
  ('implantologia', 'Implantología', true),
  ('odontopediatria', 'Odontopediatría', true),
  ('rehabilitacion_oral', 'Rehabilitación oral', true),
  ('cirugia_oral', 'Cirugía oral', true)
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  "isActive" = true,
  "updatedAt" = now();

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS "birthDate" timestamp,
  ADD COLUMN IF NOT EXISTS "professionalLicenseNumber" text,
  ADD COLUMN IF NOT EXISTS rut text,
  ADD COLUMN IF NOT EXISTS "professionalSpecialtyId" uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_users_professional_specialty'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT fk_users_professional_specialty
      FOREIGN KEY ("professionalSpecialtyId")
      REFERENCES professional_specialties(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_professional_specialty
  ON users ("professionalSpecialtyId");

COMMIT;
