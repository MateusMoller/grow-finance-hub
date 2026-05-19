CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.organizations (slug, name)
VALUES ('grow', 'Grow')
ON CONFLICT (slug) DO NOTHING;

CREATE OR REPLACE FUNCTION public.default_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT id FROM public.organizations WHERE slug = 'grow' LIMIT 1
$$;

CREATE TABLE IF NOT EXISTS public.organization_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT 'Grow',
  primary_email text,
  phone text,
  whatsapp text,
  domain text,
  public_keys jsonb NOT NULL DEFAULT '{}'::jsonb,
  module_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  notification_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  operational_limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  feature_flags jsonb NOT NULL DEFAULT '{
    "portal": true,
    "financeiro": true,
    "obrigacoes": true,
    "ia": true,
    "whatsapp": true,
    "open_finance": true,
    "acessorias": true,
    "robo_documentos": true,
    "crm": true,
    "usuarios": true,
    "relatorios": true,
    "newsletter": true
  }'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.organization_settings (organization_id, display_name)
SELECT public.default_organization_id(), 'Grow'
WHERE public.default_organization_id() IS NOT NULL
ON CONFLICT (organization_id) DO NOTHING;

ALTER TABLE public.user_roles
  ALTER COLUMN organization_id SET DEFAULT public.default_organization_id();

UPDATE public.user_roles
SET organization_id = public.default_organization_id()
WHERE organization_id IS NULL
  AND public.default_organization_id() IS NOT NULL;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'clients',
    'client_requests',
    'request_messages',
    'client_documents',
    'client_portal_tasks',
    'form_submissions',
    'user_settings',
    'integration_api_credentials'
  ]
  LOOP
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

CREATE TABLE IF NOT EXISTS public.client_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.default_organization_id(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'owner',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS client_users_client_user_key
  ON public.client_users (client_id, user_id);

CREATE INDEX IF NOT EXISTS idx_client_users_organization_id
  ON public.client_users (organization_id);

CREATE INDEX IF NOT EXISTS idx_client_users_user_id
  ON public.client_users (user_id);

INSERT INTO public.client_users (organization_id, client_id, user_id, role, status)
SELECT
  COALESCE(c.organization_id, public.default_organization_id()),
  c.id,
  c.portal_user_id,
  'owner',
  'active'
FROM public.clients c
WHERE c.portal_user_id IS NOT NULL
ON CONFLICT (client_id, user_id) DO UPDATE
SET
  organization_id = EXCLUDED.organization_id,
  status = 'active',
  updated_at = now();

CREATE TABLE IF NOT EXISTS public.operational_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.default_organization_id(),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  result text NOT NULL DEFAULT 'success',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  request_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_operational_audit_logs_org_created_at
  ON public.operational_audit_logs (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_operational_audit_logs_client_id
  ON public.operational_audit_logs (client_id);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal can view organizations" ON public.organizations;
CREATE POLICY "Internal can view organizations"
ON public.organizations FOR SELECT TO authenticated
USING (
  public.is_internal_user(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.client_users cu
    WHERE cu.organization_id = organizations.id
      AND cu.user_id = auth.uid()
      AND cu.status = 'active'
  )
);

DROP POLICY IF EXISTS "Internal can view organization settings" ON public.organization_settings;
CREATE POLICY "Internal can view organization settings"
ON public.organization_settings FOR SELECT TO authenticated
USING (
  public.is_internal_user(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.client_users cu
    WHERE cu.organization_id = organization_settings.organization_id
      AND cu.user_id = auth.uid()
      AND cu.status = 'active'
  )
);

DROP POLICY IF EXISTS "Users can view own client links" ON public.client_users;
CREATE POLICY "Users can view own client links"
ON public.client_users FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "Internal can manage client links" ON public.client_users;
CREATE POLICY "Internal can manage client links"
ON public.client_users FOR ALL TO authenticated
USING (public.is_internal_user(auth.uid()))
WITH CHECK (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "Internal can view audit logs" ON public.operational_audit_logs;
CREATE POLICY "Internal can view audit logs"
ON public.operational_audit_logs FOR SELECT TO authenticated
USING (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can insert audit logs" ON public.operational_audit_logs;
CREATE POLICY "Authenticated can insert audit logs"
ON public.operational_audit_logs FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

GRANT SELECT ON public.organizations TO authenticated;
GRANT SELECT ON public.organization_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_users TO authenticated;
GRANT SELECT, INSERT ON public.operational_audit_logs TO authenticated;
