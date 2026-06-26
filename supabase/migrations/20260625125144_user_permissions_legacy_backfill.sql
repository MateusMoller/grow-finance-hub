WITH legacy_access AS (
  SELECT
    roles.organization_id,
    roles.user_id,
    bool_or(roles.role = 'admin'::public.app_role) AS is_admin,
    bool_or(roles.role = 'client'::public.app_role) AS is_client,
    bool_or(roles.role <> 'client'::public.app_role) AS is_internal,
    CASE
      WHEN bool_or(roles.role = 'contabil'::public.app_role) THEN 'contabil'
      WHEN bool_or(roles.role = 'fiscal'::public.app_role) THEN 'fiscal'
      WHEN bool_or(roles.role = 'departamento_pessoal'::public.app_role) THEN 'departamento_pessoal'
      WHEN bool_or(roles.role = 'commercial'::public.app_role) THEN 'comercial'
      WHEN bool_or(roles.role = 'employee'::public.app_role) THEN 'geral'
      ELSE NULL
    END AS sector_code
  FROM public.user_roles roles
  WHERE roles.organization_id IS NOT NULL
  GROUP BY roles.organization_id, roles.user_id
)
INSERT INTO public.organization_user_access (
  organization_id,
  user_id,
  primary_role,
  status,
  sector_code,
  requires_access_review
)
SELECT
  legacy.organization_id,
  legacy.user_id,
  CASE
    WHEN legacy.is_admin THEN 'admin'
    WHEN legacy.is_internal THEN 'colaborador'
    WHEN legacy.is_client THEN 'cliente'
    ELSE 'cliente'
  END,
  'active',
  CASE
    WHEN legacy.is_admin OR (legacy.is_client AND NOT legacy.is_internal) THEN NULL
    ELSE legacy.sector_code
  END,
  CASE
    WHEN legacy.is_internal AND NOT legacy.is_admin AND legacy.sector_code IS NULL THEN true
    ELSE false
  END
FROM legacy_access legacy
ON CONFLICT (organization_id, user_id) DO NOTHING;

WITH grant_candidates AS (
  SELECT DISTINCT
    access.organization_id,
    access.user_id,
    module.module_key
  FROM public.organization_user_access access
  JOIN public.user_roles legacy
    ON legacy.organization_id = access.organization_id
   AND legacy.user_id = access.user_id
  CROSS JOIN LATERAL (
    SELECT unnest(
      CASE
        WHEN legacy.role IN (
          'director'::public.app_role,
          'manager'::public.app_role,
          'employee'::public.app_role,
          'commercial'::public.app_role,
          'partner'::public.app_role
        ) THEN ARRAY[
          'dashboard', 'portal', 'clientes', 'obrigacoes', 'ia', 'whatsapp',
          'open_finance', 'acessorias', 'robo_documentos', 'crm',
          'chat_interno', 'calendario', 'tarefas', 'formularios', 'relatorios',
          'notificacoes', 'newsletter', 'sugestoes', 'manual', 'configuracoes'
        ]::text[]
        WHEN legacy.role IN (
          'departamento_pessoal'::public.app_role,
          'fiscal'::public.app_role,
          'contabil'::public.app_role
        ) THEN ARRAY[
          'portal', 'clientes', 'calendario', 'tarefas', 'formularios',
          'relatorios', 'obrigacoes', 'acessorias', 'notificacoes',
          'sugestoes', 'manual'
        ]::text[]
        ELSE ARRAY[]::text[]
      END
    ) AS module_key
  ) module
  WHERE access.primary_role = 'colaborador'
)
INSERT INTO public.user_module_grants (
  organization_id,
  user_id,
  module_key,
  source
)
SELECT
  candidate.organization_id,
  candidate.user_id,
  candidate.module_key,
  'migration'
FROM grant_candidates candidate
ON CONFLICT (organization_id, user_id, module_key) DO NOTHING;

INSERT INTO public.user_module_grants (
  organization_id,
  user_id,
  module_key,
  source
)
SELECT
  access.organization_id,
  access.user_id,
  'tarefas',
  'migration'
FROM public.organization_user_access access
WHERE access.primary_role = 'colaborador'
ON CONFLICT (organization_id, user_id, module_key) DO NOTHING;

INSERT INTO public.permission_audit_entries (
  organization_id,
  target_user_id,
  action,
  new_value,
  result
)
SELECT
  access.organization_id,
  access.user_id,
  CASE
    WHEN access.requires_access_review THEN 'migration_review_required'
    ELSE 'migration_mapped'
  END,
  jsonb_build_object(
    'primary_role', access.primary_role,
    'status', access.status,
    'sector_code', access.sector_code,
    'requires_access_review', access.requires_access_review,
    'enabled_modules', COALESCE((
      SELECT jsonb_agg(grant_row.module_key ORDER BY grant_row.module_key)
      FROM public.user_module_grants grant_row
      WHERE grant_row.organization_id = access.organization_id
        AND grant_row.user_id = access.user_id
    ), '[]'::jsonb)
  ),
  'success'
FROM public.organization_user_access access
WHERE NOT EXISTS (
  SELECT 1
  FROM public.permission_audit_entries audit
  WHERE audit.organization_id = access.organization_id
    AND audit.target_user_id = access.user_id
    AND audit.action IN ('migration_mapped', 'migration_review_required')
);
