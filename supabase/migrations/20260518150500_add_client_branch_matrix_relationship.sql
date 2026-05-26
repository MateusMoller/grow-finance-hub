-- Add matrix/branch relationship to clients and allow shared portal e-mail
-- for branches linked to the same organization.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS client_entity_type text NOT NULL DEFAULT 'matriz',
  ADD COLUMN IF NOT EXISTS parent_client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS clients_entity_type_check;

ALTER TABLE public.clients
  ADD CONSTRAINT clients_entity_type_check
  CHECK (client_entity_type IN ('matriz', 'filial'));

ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS clients_branch_parent_check;

ALTER TABLE public.clients
  ADD CONSTRAINT clients_branch_parent_check
  CHECK (
    (client_entity_type = 'matriz' AND parent_client_id IS NULL)
    OR (client_entity_type = 'filial' AND parent_client_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_clients_parent_client_id
  ON public.clients (parent_client_id);

CREATE INDEX IF NOT EXISTS idx_clients_org_entity_type
  ON public.clients (organization_id, client_entity_type);

DROP INDEX IF EXISTS clients_portal_user_id_key;

CREATE OR REPLACE FUNCTION public.enforce_clients_uniqueness_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  normalized_email text;
  normalized_cnpj text;
  previous_email text;
  previous_cnpj text;
  parent_row public.clients%ROWTYPE;
BEGIN
  normalized_email := nullif(lower(btrim(coalesce(NEW.email, ''))), '');
  normalized_cnpj := nullif(regexp_replace(coalesce(NEW.cnpj, ''), '\D', '', 'g'), '');
  NEW.client_entity_type := coalesce(nullif(NEW.client_entity_type, ''), 'matriz');

  IF normalized_cnpj IS NOT NULL AND char_length(normalized_cnpj) <> 14 THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'CNPJ invalido. Informe 14 digitos.';
  END IF;

  IF NEW.client_entity_type = 'matriz' THEN
    NEW.parent_client_id := NULL;
  END IF;

  IF NEW.client_entity_type = 'filial' THEN
    IF NEW.parent_client_id IS NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'Filial deve estar vinculada a uma matriz.';
    END IF;

    IF NEW.parent_client_id = NEW.id THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'Filial nao pode ser matriz dela mesma.';
    END IF;

    SELECT *
    INTO parent_row
    FROM public.clients c
    WHERE c.id = NEW.parent_client_id;

    IF parent_row.id IS NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '23503',
        MESSAGE = 'Matriz vinculada nao encontrada.';
    END IF;

    IF parent_row.client_entity_type <> 'matriz' THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'A matriz vinculada precisa ser um cliente do tipo matriz.';
    END IF;

    IF parent_row.organization_id IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'Filial e matriz precisam pertencer a mesma organizacao.';
    END IF;
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
      AND c.organization_id = NEW.organization_id
      AND lower(btrim(coalesce(c.email, ''))) = normalized_email
      AND NOT (
        NEW.client_entity_type = 'filial'
        AND (
          c.id = NEW.parent_client_id
          OR c.parent_client_id = NEW.parent_client_id
        )
      )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = 'Ja existe cliente com este e-mail fora da matriz/filiais vinculadas.';
  END IF;

  IF normalized_cnpj IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id <> NEW.id
      AND c.organization_id = NEW.organization_id
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
