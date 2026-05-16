-- Tenant-ready foundation for Grow Finance Hub.
-- Keeps Grow as the initial organization while preparing data, roles and access helpers for future multi-organization use.

CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  legal_name text,
  primary_email text,
  primary_phone text,
  domain text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_organizations_updated_at ON public.organizations;
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.organizations (slug, name, legal_name, primary_email)
VALUES ('grow', 'Grow Finance', 'Grow Contabilidade', 'contato@contabilidadegrow.com.br')
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  legal_name = EXCLUDED.legal_name,
  primary_email = COALESCE(public.organizations.primary_email, EXCLUDED.primary_email),
  updated_at = now();

CREATE OR REPLACE FUNCTION public.default_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.organizations
  WHERE slug = 'grow'
  LIMIT 1;
$$;

CREATE TABLE IF NOT EXISTS public.organization_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT 'Grow Finance',
  primary_email text,
  primary_phone text,
  whatsapp_phone text,
  domain text,
  public_keys jsonb NOT NULL DEFAULT '{}'::jsonb,
  feature_flags jsonb NOT NULL DEFAULT '{
    "portal": true,
    "financeiro": true,
    "obrigacoes": true,
    "ia": true,
    "whatsapp": true,
    "open_finance": true,
    "acessorias": true,
    "document_robot": true
  }'::jsonb,
  notification_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  operational_limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_organization_settings_updated_at ON public.organization_settings;
CREATE TRIGGER update_organization_settings_updated_at
  BEFORE UPDATE ON public.organization_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.organization_settings (
  organization_id,
  display_name,
  primary_email,
  domain
)
SELECT id, 'Grow Finance', primary_email, domain
FROM public.organizations
WHERE slug = 'grow'
ON CONFLICT (organization_id) DO NOTHING;

ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.user_roles
  ALTER COLUMN organization_id SET DEFAULT public.default_organization_id();

UPDATE public.user_roles
SET organization_id = (SELECT id FROM public.organizations WHERE slug = 'grow')
WHERE organization_id IS NULL;

ALTER TABLE public.user_roles
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;

CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_org_role_key
  ON public.user_roles (user_id, organization_id, role);

CREATE INDEX IF NOT EXISTS idx_user_roles_organization_id
  ON public.user_roles (organization_id);

DO $$
DECLARE
  grow_org_id uuid;
  current_table_name text;
  tenant_tables text[] := ARRAY[
    'acessorias_companies_cache',
    'ai_action_logs',
    'ai_duplicate_checks',
    'ai_interactions',
    'calendar_events',
    'client_acessorias_links',
    'client_acessorias_obligations',
    'client_acessorias_uploads',
    'client_cashflow_accounts',
    'client_cashflow_consultive_alerts',
    'client_cashflow_entries',
    'client_cashflow_health_snapshots',
    'client_cashflow_rules',
    'client_data',
    'client_documents',
    'client_files',
    'client_obligation_profiles',
    'client_portal_tasks',
    'client_requests',
    'clients',
    'document_inbox_items',
    'document_ingestion_jobs',
    'email_inbox_messages',
    'expected_document_reference_files',
    'form_submissions',
    'form_templates',
    'integration_api_credentials',
    'internal_chat_messages',
    'kanban_tasks',
    'manual_user_progress',
    'manual_user_state',
    'monthly_goals',
    'newsletter_subscribers',
    'newsletters',
    'obligation_instance_events',
    'obligation_instance_files',
    'obligation_instances',
    'obligation_templates',
    'open_finance_accounts',
    'open_finance_connections',
    'open_finance_transactions',
    'open_finance_webhook_events',
    'process_documents',
    'profiles',
    'push_subscriptions',
    'request_messages',
    'saved_reports',
    'site_leads',
    'transactions',
    'user_settings',
    'whatsapp_webhook_logs'
  ];
BEGIN
  SELECT id INTO grow_org_id FROM public.organizations WHERE slug = 'grow';

  FOREACH current_table_name IN ARRAY tenant_tables LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND information_schema.tables.table_name = current_table_name
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT',
        current_table_name
      );

      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN organization_id SET DEFAULT public.default_organization_id()',
        current_table_name
      );

      EXECUTE format(
        'UPDATE public.%I SET organization_id = $1 WHERE organization_id IS NULL',
        current_table_name
      )
      USING grow_org_id;

      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN organization_id SET NOT NULL',
        current_table_name
      );

      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS idx_%s_organization_id ON public.%I (organization_id)',
        current_table_name,
        current_table_name
      );
    END IF;
  END LOOP;
END
$$;

CREATE TABLE IF NOT EXISTS public.client_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'owner',
  status text NOT NULL DEFAULT 'active',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_users_role_check CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  CONSTRAINT client_users_status_check CHECK (status IN ('active', 'inactive', 'revoked'))
);

ALTER TABLE public.client_users ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS client_users_client_user_key
  ON public.client_users (client_id, user_id);

CREATE INDEX IF NOT EXISTS idx_client_users_organization_id
  ON public.client_users (organization_id);

CREATE INDEX IF NOT EXISTS idx_client_users_user_id
  ON public.client_users (user_id);

CREATE INDEX IF NOT EXISTS idx_client_users_client_id
  ON public.client_users (client_id);

DROP TRIGGER IF EXISTS update_client_users_updated_at ON public.client_users;
CREATE TRIGGER update_client_users_updated_at
  BEFORE UPDATE ON public.client_users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.client_users (organization_id, client_id, user_id, role, status)
SELECT organization_id, id, portal_user_id, 'owner', 'active'
FROM public.clients
WHERE portal_user_id IS NOT NULL
ON CONFLICT (client_id, user_id) DO UPDATE
SET
  organization_id = EXCLUDED.organization_id,
  status = 'active',
  updated_at = now();

CREATE OR REPLACE FUNCTION public.sync_client_portal_user_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.portal_user_id IS NOT NULL THEN
    INSERT INTO public.client_users (organization_id, client_id, user_id, role, status)
    VALUES (NEW.organization_id, NEW.id, NEW.portal_user_id, 'owner', 'active')
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

CREATE TABLE IF NOT EXISTS public.operational_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  request_id text,
  result text NOT NULL DEFAULT 'success',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.operational_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_operational_audit_logs_org_created_at
  ON public.operational_audit_logs (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_operational_audit_logs_client_id
  ON public.operational_audit_logs (client_id);

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
    (
      SELECT o.id
      FROM public.organizations o
      WHERE o.slug = 'grow'
      LIMIT 1
    )
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
        OR EXISTS (
          SELECT 1
          FROM public.client_users cu
          WHERE cu.client_id = c.id
            AND cu.user_id = _user_id
            AND cu.organization_id = c.organization_id
            AND cu.status = 'active'
        )
        OR c.portal_user_id = _user_id
      )
  );
$$;

REVOKE ALL ON FUNCTION public.current_organization_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.default_organization_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_org_role(uuid, uuid, app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_internal_user(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_internal_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_client(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.current_organization_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.default_organization_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.default_organization_id() TO anon;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_internal_user(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_internal_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_client(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;

CREATE POLICY "Users can view own org roles and admins view org roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_org_role(auth.uid(), organization_id, 'admin')
    OR public.has_org_role(auth.uid(), organization_id, 'director')
    OR public.has_org_role(auth.uid(), organization_id, 'manager')
  );

CREATE POLICY "Org admins can insert roles"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_org_role(auth.uid(), organization_id, 'admin')
    OR public.has_org_role(auth.uid(), organization_id, 'director')
    OR public.has_org_role(auth.uid(), organization_id, 'manager')
  );

CREATE POLICY "Org admins can delete roles"
  ON public.user_roles
  FOR DELETE
  TO authenticated
  USING (
    public.has_org_role(auth.uid(), organization_id, 'admin')
    OR public.has_org_role(auth.uid(), organization_id, 'director')
    OR public.has_org_role(auth.uid(), organization_id, 'manager')
  );

DROP POLICY IF EXISTS "Users can view organizations they belong to" ON public.organizations;
CREATE POLICY "Users can view organizations they belong to"
  ON public.organizations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.organization_id = organizations.id
        AND ur.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.client_users cu
      WHERE cu.organization_id = organizations.id
        AND cu.user_id = auth.uid()
        AND cu.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Internal can view organization settings" ON public.organization_settings;
DROP POLICY IF EXISTS "Managers can manage organization settings" ON public.organization_settings;

CREATE POLICY "Internal can view organization settings"
  ON public.organization_settings
  FOR SELECT
  TO authenticated
  USING (public.is_internal_user(auth.uid(), organization_id));

CREATE POLICY "Managers can manage organization settings"
  ON public.organization_settings
  FOR ALL
  TO authenticated
  USING (
    public.has_org_role(auth.uid(), organization_id, 'admin')
    OR public.has_org_role(auth.uid(), organization_id, 'director')
    OR public.has_org_role(auth.uid(), organization_id, 'manager')
  )
  WITH CHECK (
    public.has_org_role(auth.uid(), organization_id, 'admin')
    OR public.has_org_role(auth.uid(), organization_id, 'director')
    OR public.has_org_role(auth.uid(), organization_id, 'manager')
  );

DROP POLICY IF EXISTS "Clients and internal can view client users" ON public.client_users;
DROP POLICY IF EXISTS "Internal can manage client users" ON public.client_users;

CREATE POLICY "Clients and internal can view client users"
  ON public.client_users
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_internal_user(auth.uid(), organization_id)
  );

CREATE POLICY "Internal can manage client users"
  ON public.client_users
  FOR ALL
  TO authenticated
  USING (public.is_internal_user(auth.uid(), organization_id))
  WITH CHECK (public.is_internal_user(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Internal can view operational audit logs" ON public.operational_audit_logs;
DROP POLICY IF EXISTS "Internal can insert operational audit logs" ON public.operational_audit_logs;

CREATE POLICY "Internal can view operational audit logs"
  ON public.operational_audit_logs
  FOR SELECT
  TO authenticated
  USING (public.is_internal_user(auth.uid(), organization_id));

CREATE POLICY "Internal can insert operational audit logs"
  ON public.operational_audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_internal_user(auth.uid(), organization_id));
