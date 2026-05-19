-- Compat tenant scope for portal requests, CNPJ cache and operational modules.
-- This keeps the Grow single-organization experience working while preparing
-- tables and authorization helpers for real organization-scoped access.

CREATE OR REPLACE FUNCTION public.current_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT ur.organization_id
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id IS NOT NULL
      ORDER BY ur.created_at ASC
      LIMIT 1
    ),
    (
      SELECT cu.organization_id
      FROM public.client_users cu
      WHERE cu.user_id = auth.uid()
        AND cu.status = 'active'
      ORDER BY cu.created_at ASC
      LIMIT 1
    ),
    public.default_organization_id()
  );
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(_user_id uuid, _organization_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.organization_id = _organization_id
      AND ur.role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_org_role(_user_id, public.current_organization_id(), _role);
$$;

CREATE OR REPLACE FUNCTION public.is_internal_user(_user_id uuid, _organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.organization_id = _organization_id
      AND ur.role IN (
        'admin',
        'director',
        'manager',
        'employee',
        'commercial',
        'partner',
        'departamento_pessoal',
        'fiscal',
        'contabil'
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_internal_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_internal_user(_user_id, public.current_organization_id());
$$;

CREATE OR REPLACE FUNCTION public.can_access_client(_user_id uuid, _client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = _client_id
      AND (
        public.is_internal_user(_user_id, c.organization_id)
        OR c.portal_user_id = _user_id
        OR EXISTS (
          SELECT 1
          FROM public.client_users cu
          WHERE cu.client_id = c.id
            AND cu.user_id = _user_id
            AND cu.organization_id = c.organization_id
            AND cu.status = 'active'
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.current_organization_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_org_role(uuid, uuid, app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_internal_user(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_internal_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_client(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.current_organization_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_internal_user(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_internal_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_client(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.sync_client_portal_user_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.portal_user_id IS NOT NULL THEN
    INSERT INTO public.client_users (organization_id, client_id, user_id, role, status)
    VALUES (
      COALESCE(NEW.organization_id, public.default_organization_id()),
      NEW.id,
      NEW.portal_user_id,
      'owner',
      'active'
    )
    ON CONFLICT (client_id, user_id) DO UPDATE
    SET
      organization_id = EXCLUDED.organization_id,
      status = 'active',
      updated_at = now();
  END IF;

  IF TG_OP = 'UPDATE'
    AND OLD.portal_user_id IS NOT NULL
    AND (NEW.portal_user_id IS NULL OR NEW.portal_user_id <> OLD.portal_user_id) THEN
    UPDATE public.client_users
    SET status = 'revoked', updated_at = now()
    WHERE client_id = NEW.id
      AND user_id = OLD.portal_user_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_client_portal_user_link ON public.clients;
CREATE TRIGGER sync_client_portal_user_link
  AFTER INSERT OR UPDATE OF portal_user_id, organization_id ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_client_portal_user_link();

ALTER TABLE public.client_requests
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

ALTER TABLE public.client_documents
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_client_requests_client_id
  ON public.client_requests (client_id);

CREATE INDEX IF NOT EXISTS idx_client_requests_org_client
  ON public.client_requests (organization_id, client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_documents_client_id
  ON public.client_documents (client_id);

CREATE INDEX IF NOT EXISTS idx_client_documents_org_client
  ON public.client_documents (organization_id, client_id, created_at DESC);

WITH primary_links AS (
  SELECT DISTINCT ON (cu.user_id, cu.organization_id)
    cu.user_id,
    cu.organization_id,
    cu.client_id
  FROM public.client_users cu
  WHERE cu.status = 'active'
  ORDER BY cu.user_id, cu.organization_id, cu.created_at DESC
)
UPDATE public.client_requests cr
SET client_id = primary_links.client_id
FROM primary_links
WHERE cr.client_id IS NULL
  AND cr.user_id = primary_links.user_id
  AND cr.organization_id = primary_links.organization_id;

UPDATE public.client_requests cr
SET client_id = c.id
FROM public.clients c
WHERE cr.client_id IS NULL
  AND cr.user_id = c.portal_user_id
  AND cr.organization_id = c.organization_id;

UPDATE public.client_documents cd
SET client_id = cr.client_id
FROM public.client_requests cr
WHERE cd.client_id IS NULL
  AND cd.request_id = cr.id
  AND cd.organization_id = cr.organization_id
  AND cr.client_id IS NOT NULL;

WITH primary_links AS (
  SELECT DISTINCT ON (cu.user_id, cu.organization_id)
    cu.user_id,
    cu.organization_id,
    cu.client_id
  FROM public.client_users cu
  WHERE cu.status = 'active'
  ORDER BY cu.user_id, cu.organization_id, cu.created_at DESC
)
UPDATE public.client_documents cd
SET client_id = primary_links.client_id
FROM primary_links
WHERE cd.client_id IS NULL
  AND cd.user_id = primary_links.user_id
  AND cd.organization_id = primary_links.organization_id;

CREATE OR REPLACE FUNCTION public.set_client_document_client_id_from_request()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.client_id IS NULL AND NEW.request_id IS NOT NULL THEN
    SELECT cr.client_id
    INTO NEW.client_id
    FROM public.client_requests cr
    WHERE cr.id = NEW.request_id
      AND cr.organization_id = NEW.organization_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_client_document_client_id_from_request ON public.client_documents;
CREATE TRIGGER set_client_document_client_id_from_request
  BEFORE INSERT OR UPDATE OF request_id, organization_id ON public.client_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.set_client_document_client_id_from_request();

ALTER TABLE public.cnpj_lookup_cache
  ADD COLUMN IF NOT EXISTS organization_id uuid DEFAULT public.default_organization_id();

UPDATE public.cnpj_lookup_cache
SET organization_id = public.default_organization_id()
WHERE organization_id IS NULL
  AND public.default_organization_id() IS NOT NULL;

ALTER TABLE public.cnpj_lookup_cache
  ALTER COLUMN organization_id SET NOT NULL;

DO $$
DECLARE
  pk_name text;
BEGIN
  SELECT conname INTO pk_name
  FROM pg_constraint
  WHERE conrelid = 'public.cnpj_lookup_cache'::regclass
    AND contype = 'p'
  LIMIT 1;

  IF pk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.cnpj_lookup_cache DROP CONSTRAINT %I', pk_name);
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS cnpj_lookup_cache_org_cnpj_key
  ON public.cnpj_lookup_cache (organization_id, cnpj);

CREATE INDEX IF NOT EXISTS idx_cnpj_lookup_cache_organization_updated_at
  ON public.cnpj_lookup_cache (organization_id, updated_at DESC);

DO $$
DECLARE
  table_name text;
  scoped_tables text[] := ARRAY[
    'client_data',
    'client_files',
    'kanban_tasks',
    'calendar_events',
    'obligation_templates',
    'client_obligation_profiles',
    'obligation_instances',
    'obligation_instance_events',
    'document_inbox_items',
    'obligation_instance_files',
    'expected_document_reference_files',
    'client_cashflow_accounts',
    'client_cashflow_entries',
    'client_cashflow_rules',
    'client_cashflow_consultive_alerts',
    'client_cashflow_health_snapshots',
    'open_finance_connections',
    'open_finance_accounts',
    'open_finance_transactions',
    'open_finance_webhook_events',
    'ai_interactions',
    'ai_action_logs',
    'ai_duplicate_checks',
    'whatsapp_webhook_logs'
  ];
BEGIN
  FOREACH table_name IN ARRAY scoped_tables LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS organization_id uuid DEFAULT public.default_organization_id()',
        table_name
      );

      EXECUTE format(
        'UPDATE public.%I SET organization_id = public.default_organization_id() WHERE organization_id IS NULL AND public.default_organization_id() IS NOT NULL',
        table_name
      );

      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS idx_%s_organization_id ON public.%I (organization_id)',
        table_name,
        table_name
      );
    END IF;
  END LOOP;
END
$$;

DO $$
DECLARE
  table_name text;
  client_id_tables text[] := ARRAY[
    'client_data',
    'client_files',
    'client_obligation_profiles',
    'obligation_instances',
    'document_inbox_items',
    'client_cashflow_accounts',
    'client_cashflow_entries',
    'client_cashflow_rules',
    'client_cashflow_consultive_alerts',
    'client_cashflow_health_snapshots',
    'open_finance_connections',
    'open_finance_accounts',
    'open_finance_transactions'
  ];
  cliente_id_tables text[] := ARRAY[
    'ai_interactions',
    'ai_action_logs',
    'ai_duplicate_checks',
    'whatsapp_webhook_logs'
  ];
BEGIN
  FOREACH table_name IN ARRAY client_id_tables LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format(
        'UPDATE public.%I t SET organization_id = c.organization_id FROM public.clients c WHERE t.client_id = c.id AND c.organization_id IS NOT NULL',
        table_name
      );
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS idx_%s_org_client ON public.%I (organization_id, client_id)',
        table_name,
        table_name
      );
    END IF;
  END LOOP;

  FOREACH table_name IN ARRAY cliente_id_tables LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format(
        'UPDATE public.%I t SET organization_id = c.organization_id FROM public.clients c WHERE t.cliente_id = c.id AND c.organization_id IS NOT NULL',
        table_name
      );
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS idx_%s_org_cliente ON public.%I (organization_id, cliente_id)',
        table_name,
        table_name
      );
    END IF;
  END LOOP;
END
$$;

UPDATE public.obligation_instance_events event
SET organization_id = instance.organization_id
FROM public.obligation_instances instance
WHERE event.instance_id = instance.id
  AND instance.organization_id IS NOT NULL;

UPDATE public.obligation_instance_files file
SET organization_id = instance.organization_id
FROM public.obligation_instances instance
WHERE file.instance_id = instance.id
  AND instance.organization_id IS NOT NULL;

UPDATE public.expected_document_reference_files reference_file
SET organization_id = profile.organization_id
FROM public.client_obligation_profiles profile
WHERE reference_file.profile_id = profile.id
  AND profile.organization_id IS NOT NULL;

UPDATE public.expected_document_reference_files reference_file
SET organization_id = template.organization_id
FROM public.obligation_templates template
WHERE reference_file.organization_id IS NULL
  AND reference_file.template_id = template.id
  AND template.organization_id IS NOT NULL;

DROP POLICY IF EXISTS "Tenant can view client requests by client link" ON public.client_requests;
CREATE POLICY "Tenant can view client requests by client link"
  ON public.client_requests
  FOR SELECT
  TO authenticated
  USING (
    public.is_internal_user(auth.uid(), organization_id)
    OR (client_id IS NOT NULL AND public.can_access_client(auth.uid(), client_id))
    OR (client_id IS NULL AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Tenant can insert client requests by client link" ON public.client_requests;
CREATE POLICY "Tenant can insert client requests by client link"
  ON public.client_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_internal_user(auth.uid(), organization_id)
    OR (
      user_id = auth.uid()
      AND (
        (client_id IS NOT NULL AND public.can_access_client(auth.uid(), client_id))
        OR client_id IS NULL
      )
    )
  );

DROP POLICY IF EXISTS "Tenant can update client requests by client link" ON public.client_requests;
CREATE POLICY "Tenant can update client requests by client link"
  ON public.client_requests
  FOR UPDATE
  TO authenticated
  USING (
    public.is_internal_user(auth.uid(), organization_id)
    OR (client_id IS NOT NULL AND public.can_access_client(auth.uid(), client_id))
  )
  WITH CHECK (
    public.is_internal_user(auth.uid(), organization_id)
    OR (client_id IS NOT NULL AND public.can_access_client(auth.uid(), client_id))
  );

DROP POLICY IF EXISTS "Tenant can view client documents by client link" ON public.client_documents;
CREATE POLICY "Tenant can view client documents by client link"
  ON public.client_documents
  FOR SELECT
  TO authenticated
  USING (
    public.is_internal_user(auth.uid(), organization_id)
    OR (client_id IS NOT NULL AND public.can_access_client(auth.uid(), client_id))
    OR (client_id IS NULL AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Tenant can insert client documents by client link" ON public.client_documents;
CREATE POLICY "Tenant can insert client documents by client link"
  ON public.client_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      (client_id IS NOT NULL AND public.can_access_client(auth.uid(), client_id))
      OR client_id IS NULL
    )
  );

DROP POLICY IF EXISTS "Tenant can delete client documents by client link" ON public.client_documents;
CREATE POLICY "Tenant can delete client documents by client link"
  ON public.client_documents
  FOR DELETE
  TO authenticated
  USING (
    public.is_internal_user(auth.uid(), organization_id)
    OR (client_id IS NOT NULL AND public.can_access_client(auth.uid(), client_id))
    OR (client_id IS NULL AND user_id = auth.uid())
  );

GRANT EXECUTE ON FUNCTION public.sync_client_portal_user_link() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_client_document_client_id_from_request() TO authenticated;
