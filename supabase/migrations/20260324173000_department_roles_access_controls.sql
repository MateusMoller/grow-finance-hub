-- Add department-specific app roles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'departamento_pessoal'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'departamento_pessoal';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'fiscal'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'fiscal';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'contabil'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'contabil';
  END IF;
END
$$;
