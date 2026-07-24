CREATE TABLE IF NOT EXISTS public.portal_request_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text NOT NULL,
  description text NULL,
  sector text NOT NULL DEFAULT 'Geral',
  task_title_template text NOT NULL DEFAULT '',
  task_description_template text NULL,
  form_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 100,
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT portal_request_types_title_not_empty CHECK (length(trim(title)) > 0),
  CONSTRAINT portal_request_types_slug_not_empty CHECK (length(trim(slug)) > 0),
  CONSTRAINT portal_request_types_form_fields_array CHECK (jsonb_typeof(form_fields) = 'array')
);

CREATE UNIQUE INDEX IF NOT EXISTS portal_request_types_org_slug_key
  ON public.portal_request_types (COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::uuid), slug);

CREATE INDEX IF NOT EXISTS idx_portal_request_types_organization_active
  ON public.portal_request_types (organization_id, is_active, sort_order);

ALTER TABLE public.portal_request_types ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_request_types TO authenticated;

DROP POLICY IF EXISTS "Authenticated users can view request types" ON public.portal_request_types;
CREATE POLICY "Authenticated users can view request types"
  ON public.portal_request_types
  FOR SELECT
  TO authenticated
  USING (
    organization_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.organization_user_access access
      WHERE access.organization_id = portal_request_types.organization_id
        AND access.user_id = (SELECT auth.uid())
        AND access.status = 'active'
    )
    OR EXISTS (
      SELECT 1
      FROM public.client_users link
      WHERE link.organization_id = portal_request_types.organization_id
        AND link.user_id = (SELECT auth.uid())
        AND link.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Internal users can manage request types" ON public.portal_request_types;
CREATE POLICY "Internal users can manage request types"
  ON public.portal_request_types
  FOR ALL
  TO authenticated
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.organization_user_access access
      WHERE access.organization_id = portal_request_types.organization_id
        AND access.user_id = (SELECT auth.uid())
        AND access.status = 'active'
        AND access.primary_role IN ('admin', 'colaborador')
    )
  )
  WITH CHECK (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.organization_user_access access
      WHERE access.organization_id = portal_request_types.organization_id
        AND access.user_id = (SELECT auth.uid())
        AND access.status = 'active'
        AND access.primary_role IN ('admin', 'colaborador')
    )
  );

DROP TRIGGER IF EXISTS update_portal_request_types_updated_at ON public.portal_request_types;
CREATE TRIGGER update_portal_request_types_updated_at
  BEFORE UPDATE ON public.portal_request_types
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.portal_request_types (
  title,
  slug,
  description,
  sector,
  task_title_template,
  task_description_template,
  form_fields,
  sort_order,
  is_active
)
VALUES
  (
    'Nota fiscal',
    'nota-fiscal',
    'Solicite emissão, ajuste ou conferência de nota fiscal.',
    'Fiscal',
    'Nota fiscal',
    'Solicitação relacionada a nota fiscal.',
    '[{"id":"tipo_nota","label":"Tipo de nota","type":"text","required":false},{"id":"competencia","label":"Competência","type":"text","required":false}]'::jsonb,
    10,
    true
  ),
  (
    'Admissão',
    'admissao',
    'Envie informações para abertura de admissão de colaborador.',
    'Departamento Pessoal',
    'Admissão de colaborador',
    'Solicitação de admissão de colaborador.',
    '[{"id":"nome_colaborador","label":"Nome do colaborador","type":"text","required":true},{"id":"data_admissao","label":"Data prevista de admissão","type":"date","required":false}]'::jsonb,
    20,
    true
  ),
  (
    'Demissão',
    'demissao',
    'Encaminhe uma solicitação de encerramento de vínculo.',
    'Departamento Pessoal',
    'Demissão de colaborador',
    'Solicitação de demissão de colaborador.',
    '[{"id":"nome_colaborador","label":"Nome do colaborador","type":"text","required":true},{"id":"data_desligamento","label":"Data prevista de desligamento","type":"date","required":false}]'::jsonb,
    30,
    true
  )
ON CONFLICT DO NOTHING;
