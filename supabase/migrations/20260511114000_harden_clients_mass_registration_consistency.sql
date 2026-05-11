-- Hardening for mass client registration consistency
-- 1) Safe upsert key on client_data
-- 2) Role-compatible delete policy for client_data
-- 3) Guard against new duplicate clients by normalized email/CNPJ

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'client_data_client_category_field_period_key'
  ) THEN
    CREATE UNIQUE INDEX client_data_client_category_field_period_key
      ON public.client_data (client_id, category, field_name, period) NULLS NOT DISTINCT;
  END IF;
END $$;

DROP POLICY IF EXISTS "Admins can delete client_data" ON public.client_data;
DROP POLICY IF EXISTS "Role-based delete client_data" ON public.client_data;

CREATE POLICY "Role-based delete client_data"
  ON public.client_data
  FOR DELETE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'manager')
    OR has_role(auth.uid(), 'employee')
    OR (
      has_role(auth.uid(), 'departamento_pessoal')
      AND (category = 'dp' OR category LIKE 'cadastro_%')
    )
    OR (
      has_role(auth.uid(), 'fiscal')
      AND (category = 'fiscal' OR category LIKE 'cadastro_%')
    )
    OR (
      has_role(auth.uid(), 'contabil')
      AND (category = 'contabilidade' OR category LIKE 'cadastro_%')
    )
  );

CREATE INDEX IF NOT EXISTS clients_email_normalized_idx
  ON public.clients ((lower(btrim(coalesce(email, '')))))
  WHERE nullif(btrim(coalesce(email, '')), '') IS NOT NULL;

CREATE INDEX IF NOT EXISTS clients_cnpj_normalized_idx
  ON public.clients ((nullif(regexp_replace(coalesce(cnpj, ''), '\D', '', 'g'), '')))
  WHERE nullif(regexp_replace(coalesce(cnpj, ''), '\D', '', 'g'), '') IS NOT NULL;

CREATE OR REPLACE FUNCTION public.enforce_clients_uniqueness_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  normalized_email text;
  normalized_cnpj text;
  previous_email text;
  previous_cnpj text;
BEGIN
  normalized_email := nullif(lower(btrim(coalesce(NEW.email, ''))), '');
  normalized_cnpj := nullif(regexp_replace(coalesce(NEW.cnpj, ''), '\D', '', 'g'), '');

  IF normalized_cnpj IS NOT NULL AND char_length(normalized_cnpj) <> 14 THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'CNPJ invalido. Informe 14 digitos.';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    previous_email := nullif(lower(btrim(coalesce(OLD.email, ''))), '');
    previous_cnpj := nullif(regexp_replace(coalesce(OLD.cnpj, ''), '\D', '', 'g'), '');

    IF normalized_email IS NOT DISTINCT FROM previous_email
      AND normalized_cnpj IS NOT DISTINCT FROM previous_cnpj THEN
      NEW.email := normalized_email;
      NEW.cnpj := normalized_cnpj;
      RETURN NEW;
    END IF;
  END IF;

  IF normalized_email IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id <> NEW.id
      AND lower(btrim(coalesce(c.email, ''))) = normalized_email
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = 'Ja existe cliente com este e-mail.';
  END IF;

  IF normalized_cnpj IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id <> NEW.id
      AND nullif(regexp_replace(coalesce(c.cnpj, ''), '\D', '', 'g'), '') = normalized_cnpj
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = 'Ja existe cliente com este CNPJ.';
  END IF;

  NEW.email := normalized_email;
  NEW.cnpj := normalized_cnpj;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_clients_uniqueness_guard ON public.clients;

CREATE TRIGGER trg_enforce_clients_uniqueness_guard
  BEFORE INSERT OR UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_clients_uniqueness_guard();
