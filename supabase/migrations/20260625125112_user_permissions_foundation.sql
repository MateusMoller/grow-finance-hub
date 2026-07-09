CREATE TABLE public.organization_user_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  primary_role text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  sector_code text,
  requires_access_review boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_user_access_org_user_key UNIQUE (organization_id, user_id),
  CONSTRAINT organization_user_access_role_check
    CHECK (primary_role IN ('admin', 'colaborador', 'cliente')),
  CONSTRAINT organization_user_access_status_check
    CHECK (status IN ('pending', 'active', 'suspended', 'inactive')),
  CONSTRAINT organization_user_access_sector_check
    CHECK (
      sector_code IS NULL
      OR sector_code IN (
        'contabil',
        'fiscal',
        'departamento_pessoal',
        'financeiro',
        'comercial',
        'societario',
        'geral'
      )
    ),
  CONSTRAINT organization_user_access_role_sector_check
    CHECK (
      (
        primary_role = 'colaborador'
        AND (
          status <> 'active'
          OR sector_code IS NOT NULL
          OR requires_access_review
        )
      )
      OR (
        primary_role IN ('admin', 'cliente')
        AND sector_code IS NULL
      )
    )
);

CREATE TABLE public.user_module_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_module_grants_org_user_module_key
    UNIQUE (organization_id, user_id, module_key),
  CONSTRAINT user_module_grants_access_fk
    FOREIGN KEY (organization_id, user_id)
    REFERENCES public.organization_user_access (organization_id, user_id)
    ON DELETE CASCADE,
  CONSTRAINT user_module_grants_module_check
    CHECK (
      module_key IN (
        'dashboard',
        'portal',
        'clientes',
        'cadastrar_clientes',
        'financeiro',
        'obrigacoes',
        'ia',
        'whatsapp',
        'open_finance',
        'acessorias',
        'robo_documentos',
        'crm',
        'chat_interno',
        'calendario',
        'tarefas',
        'formularios',
        'relatorios',
        'notificacoes',
        'usuarios',
        'newsletter',
        'sugestoes',
        'manual',
        'configuracoes'
      )
    ),
  CONSTRAINT user_module_grants_source_check
    CHECK (source IN ('admin', 'default', 'migration'))
);

CREATE TABLE public.permission_audit_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  previous_value jsonb,
  new_value jsonb,
  reason text,
  result text NOT NULL DEFAULT 'success',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT permission_audit_entries_result_check
    CHECK (result IN ('success', 'denied'))
);

CREATE INDEX idx_organization_user_access_role_status
  ON public.organization_user_access (organization_id, primary_role, status);
CREATE INDEX idx_organization_user_access_sector_status
  ON public.organization_user_access (organization_id, sector_code, status);
CREATE INDEX idx_organization_user_access_review
  ON public.organization_user_access (organization_id, requires_access_review)
  WHERE requires_access_review;
CREATE INDEX idx_user_module_grants_user
  ON public.user_module_grants (organization_id, user_id);
CREATE INDEX idx_user_module_grants_module
  ON public.user_module_grants (organization_id, module_key, user_id);
CREATE INDEX idx_client_users_active_user
  ON public.client_users (organization_id, user_id, status, client_id);
CREATE INDEX idx_permission_audit_org_created
  ON public.permission_audit_entries (organization_id, created_at DESC);
CREATE INDEX idx_permission_audit_target_created
  ON public.permission_audit_entries (organization_id, target_user_id, created_at DESC);
CREATE INDEX idx_permission_audit_actor_created
  ON public.permission_audit_entries (organization_id, actor_user_id, created_at DESC);
CREATE INDEX idx_permission_audit_action_created
  ON public.permission_audit_entries (organization_id, action, created_at DESC);

CREATE TRIGGER update_organization_user_access_updated_at
  BEFORE UPDATE ON public.organization_user_access
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.organization_user_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_module_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_audit_entries ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.organization_user_access FROM PUBLIC, anon;
REVOKE ALL ON public.user_module_grants FROM PUBLIC, anon;
REVOKE ALL ON public.permission_audit_entries FROM PUBLIC, anon;

GRANT SELECT ON public.organization_user_access TO authenticated;
GRANT SELECT ON public.user_module_grants TO authenticated;
GRANT SELECT ON public.permission_audit_entries TO authenticated;
GRANT ALL ON public.organization_user_access TO service_role;
GRANT ALL ON public.user_module_grants TO service_role;
GRANT ALL ON public.permission_audit_entries TO service_role;

CREATE POLICY "Users read own access and legacy admins read organization access"
  ON public.organization_user_access
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.has_org_role(
      (SELECT auth.uid()),
      organization_id,
      'admin'::public.app_role
    )
  );

CREATE POLICY "Users read own grants and legacy admins read organization grants"
  ON public.user_module_grants
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.has_org_role(
      (SELECT auth.uid()),
      organization_id,
      'admin'::public.app_role
    )
  );

CREATE POLICY "Legacy admins read organization permission audit"
  ON public.permission_audit_entries
  FOR SELECT
  TO authenticated
  USING (
    public.has_org_role(
      (SELECT auth.uid()),
      organization_id,
      'admin'::public.app_role
    )
  );
