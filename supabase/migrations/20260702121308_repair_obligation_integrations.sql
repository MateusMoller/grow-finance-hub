-- Repair obligation integrations broken by the native obligations refactor.
-- Keeps this migration idempotent because the remote migration history is not fully aligned with local files.

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;

ALTER TABLE public.obligation_templates
  ADD COLUMN IF NOT EXISTS normalized_name text,
  ADD COLUMN IF NOT EXISTS duplicate_group_key text,
  ADD COLUMN IF NOT EXISTS baseline_source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS catalog_review_status text NOT NULL DEFAULT 'approved';

UPDATE public.obligation_templates
SET normalized_name = lower(regexp_replace(public.unaccent(coalesce(name, '')), '[^a-zA-Z0-9]+', ' ', 'g'))
WHERE normalized_name IS NULL;

ALTER TABLE public.client_obligation_profiles
  ADD COLUMN IF NOT EXISTS source_kind text NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS source_load_id uuid,
  ADD COLUMN IF NOT EXISTS source_load_item_id uuid,
  ADD COLUMN IF NOT EXISTS applied_regime text,
  ADD COLUMN IF NOT EXISTS application_batch_id uuid,
  ADD COLUMN IF NOT EXISTS inactivation_reason text,
  ADD COLUMN IF NOT EXISTS sync_status text NOT NULL DEFAULT 'current',
  ADD COLUMN IF NOT EXISTS conditional_review_reason text;

CREATE TABLE IF NOT EXISTS public.tax_regime_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE DEFAULT public.default_organization_id(),
  code text NOT NULL,
  label text NOT NULL,
  aliases text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tax_regime_definitions_code_check
    CHECK (code IN ('simples_nacional', 'lucro_presumido', 'lucro_real', 'mei')),
  CONSTRAINT tax_regime_definitions_unique_code UNIQUE (organization_id, code)
);

CREATE TABLE IF NOT EXISTS public.obligation_regime_loads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE DEFAULT public.default_organization_id(),
  tax_regime_code text NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'in_review',
  version integer NOT NULL DEFAULT 1,
  description text,
  owner_sector text,
  review_notes text,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_until date,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT obligation_regime_loads_regime_check
    CHECK (tax_regime_code IN ('simples_nacional', 'lucro_presumido', 'lucro_real', 'mei')),
  CONSTRAINT obligation_regime_loads_status_check
    CHECK (status IN ('active', 'inactive', 'in_review')),
  CONSTRAINT obligation_regime_loads_effective_range_check
    CHECK (effective_until IS NULL OR effective_until >= effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS obligation_regime_loads_one_active_per_regime
  ON public.obligation_regime_loads (organization_id, tax_regime_code)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS public.obligation_regime_load_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE DEFAULT public.default_organization_id(),
  load_id uuid NOT NULL REFERENCES public.obligation_regime_loads(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.obligation_templates(id) ON DELETE RESTRICT,
  applicability text NOT NULL DEFAULT 'required',
  condition_key text,
  default_start_policy text NOT NULL DEFAULT 'client_created_at',
  default_due_day_override integer,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT obligation_regime_load_items_applicability_check
    CHECK (applicability IN ('required', 'optional', 'conditional')),
  CONSTRAINT obligation_regime_load_items_condition_check
    CHECK (
      (applicability <> 'conditional' AND condition_key IS NULL)
      OR (applicability = 'conditional' AND condition_key IN (
        'has_employees',
        'iss_applicable',
        'icms_taxpayer',
        'service_provider',
        'accounting_contracted'
      ))
    ),
  CONSTRAINT obligation_regime_load_items_start_policy_check
    CHECK (default_start_policy IN ('client_created_at', 'current_month', 'next_month', 'custom')),
  CONSTRAINT obligation_regime_load_items_due_day_check
    CHECK (default_due_day_override IS NULL OR default_due_day_override BETWEEN 1 AND 31)
);

CREATE UNIQUE INDEX IF NOT EXISTS obligation_regime_load_items_unique_active_template
  ON public.obligation_regime_load_items (organization_id, load_id, template_id)
  WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.obligation_load_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE DEFAULT public.default_organization_id(),
  load_id uuid NOT NULL REFERENCES public.obligation_regime_loads(id) ON DELETE CASCADE,
  tax_regime_code text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  scope text NOT NULL DEFAULT 'existing_clients_same_regime',
  clients_total integer NOT NULL DEFAULT 0,
  clients_processed integer NOT NULL DEFAULT 0,
  profiles_created integer NOT NULL DEFAULT 0,
  profiles_reactivated integer NOT NULL DEFAULT 0,
  profiles_inactivated_future integer NOT NULL DEFAULT 0,
  profiles_skipped integer NOT NULL DEFAULT 0,
  review_required integer NOT NULL DEFAULT 0,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  started_by uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT obligation_load_sync_runs_status_check
    CHECK (status IN ('queued', 'processing', 'completed', 'completed_with_warnings', 'failed', 'cancelled')),
  CONSTRAINT obligation_load_sync_runs_scope_check
    CHECK (scope = 'existing_clients_same_regime')
);

CREATE INDEX IF NOT EXISTS idx_obligation_regime_loads_org_regime_status
  ON public.obligation_regime_loads (organization_id, tax_regime_code, status);
CREATE INDEX IF NOT EXISTS idx_obligation_regime_load_items_org_load_template
  ON public.obligation_regime_load_items (organization_id, load_id, template_id);
CREATE INDEX IF NOT EXISTS idx_obligation_load_sync_runs_org_load_status_started
  ON public.obligation_load_sync_runs (organization_id, load_id, status, started_at DESC);

ALTER TABLE public.tax_regime_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obligation_regime_loads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obligation_regime_load_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obligation_load_sync_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal can view tax regime definitions" ON public.tax_regime_definitions;
CREATE POLICY "Internal can view tax regime definitions"
  ON public.tax_regime_definitions FOR SELECT TO authenticated
  USING (public.is_internal_user((SELECT auth.uid()), organization_id));

DROP POLICY IF EXISTS "Managers can manage tax regime definitions" ON public.tax_regime_definitions;
CREATE POLICY "Managers can manage tax regime definitions"
  ON public.tax_regime_definitions FOR ALL TO authenticated
  USING (
    public.has_canonical_org_role((SELECT auth.uid()), organization_id, 'admin')
    OR public.has_canonical_org_role((SELECT auth.uid()), organization_id, 'director')
    OR public.has_canonical_org_role((SELECT auth.uid()), organization_id, 'manager')
  )
  WITH CHECK (
    public.has_canonical_org_role((SELECT auth.uid()), organization_id, 'admin')
    OR public.has_canonical_org_role((SELECT auth.uid()), organization_id, 'director')
    OR public.has_canonical_org_role((SELECT auth.uid()), organization_id, 'manager')
  );

DROP POLICY IF EXISTS "Internal can view obligation regime loads" ON public.obligation_regime_loads;
CREATE POLICY "Internal can view obligation regime loads"
  ON public.obligation_regime_loads FOR SELECT TO authenticated
  USING (public.is_internal_user((SELECT auth.uid()), organization_id));

DROP POLICY IF EXISTS "Managers can manage obligation regime loads" ON public.obligation_regime_loads;
CREATE POLICY "Managers can manage obligation regime loads"
  ON public.obligation_regime_loads FOR ALL TO authenticated
  USING (
    public.has_canonical_org_role((SELECT auth.uid()), organization_id, 'admin')
    OR public.has_canonical_org_role((SELECT auth.uid()), organization_id, 'director')
    OR public.has_canonical_org_role((SELECT auth.uid()), organization_id, 'manager')
  )
  WITH CHECK (
    public.has_canonical_org_role((SELECT auth.uid()), organization_id, 'admin')
    OR public.has_canonical_org_role((SELECT auth.uid()), organization_id, 'director')
    OR public.has_canonical_org_role((SELECT auth.uid()), organization_id, 'manager')
  );

DROP POLICY IF EXISTS "Internal can view obligation regime load items" ON public.obligation_regime_load_items;
CREATE POLICY "Internal can view obligation regime load items"
  ON public.obligation_regime_load_items FOR SELECT TO authenticated
  USING (public.is_internal_user((SELECT auth.uid()), organization_id));

DROP POLICY IF EXISTS "Managers can manage obligation regime load items" ON public.obligation_regime_load_items;
CREATE POLICY "Managers can manage obligation regime load items"
  ON public.obligation_regime_load_items FOR ALL TO authenticated
  USING (
    public.has_canonical_org_role((SELECT auth.uid()), organization_id, 'admin')
    OR public.has_canonical_org_role((SELECT auth.uid()), organization_id, 'director')
    OR public.has_canonical_org_role((SELECT auth.uid()), organization_id, 'manager')
  )
  WITH CHECK (
    public.has_canonical_org_role((SELECT auth.uid()), organization_id, 'admin')
    OR public.has_canonical_org_role((SELECT auth.uid()), organization_id, 'director')
    OR public.has_canonical_org_role((SELECT auth.uid()), organization_id, 'manager')
  );

DROP POLICY IF EXISTS "Internal can view obligation sync runs" ON public.obligation_load_sync_runs;
CREATE POLICY "Internal can view obligation sync runs"
  ON public.obligation_load_sync_runs FOR SELECT TO authenticated
  USING (public.is_internal_user((SELECT auth.uid()), organization_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tax_regime_definitions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.obligation_regime_loads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.obligation_regime_load_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.obligation_load_sync_runs TO authenticated;

INSERT INTO public.tax_regime_definitions (organization_id, code, label, aliases, sort_order)
SELECT org.id, seed.code, seed.label, seed.aliases, seed.sort_order
FROM public.organizations org
CROSS JOIN (
  VALUES
    ('simples_nacional', 'Simples Nacional', ARRAY['simples', 'simples nacional', 'sn'], 10),
    ('lucro_presumido', 'Lucro Presumido', ARRAY['lucro presumido', 'presumido', 'lp'], 20),
    ('lucro_real', 'Lucro Real', ARRAY['lucro real', 'real', 'lr'], 30),
    ('mei', 'MEI', ARRAY['mei', 'microempreendedor individual', 'simei'], 40)
) AS seed(code, label, aliases, sort_order)
ON CONFLICT (organization_id, code) DO UPDATE
SET label = EXCLUDED.label,
    aliases = EXCLUDED.aliases,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();

INSERT INTO public.calendar_events (
  organization_id,
  title,
  description,
  entry_type,
  priority,
  sector,
  due_at,
  all_day,
  status,
  integration_source,
  integration_key
)
SELECT
  instance.organization_id,
  template.name || ' - ' || instance.competence_label,
  client.name || E'\nCompetencia: ' || instance.competence_label,
  'obrigacao',
  instance.priority,
  template.sector,
  (instance.technical_due_date::date + time '09:00')::timestamptz,
  true,
  CASE WHEN instance.status IN ('concluida', 'cancelada') THEN 'completed' ELSE 'pending' END,
  'grow_obligation',
  'instance:' || instance.id::text
FROM public.obligation_instances instance
JOIN public.obligation_templates template ON template.id = instance.template_id
JOIN public.clients client ON client.id = instance.client_id
WHERE instance.organization_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.calendar_events event
    WHERE event.organization_id = instance.organization_id
      AND event.integration_source = 'grow_obligation'
      AND event.integration_key = 'instance:' || instance.id::text
  );

INSERT INTO public.kanban_tasks (
  organization_id,
  title,
  description,
  sector,
  client_name,
  assignee,
  assigned_to_user_id,
  priority,
  status,
  due_date,
  integration_source,
  integration_task_id,
  integration_payload
)
SELECT
  instance.organization_id,
  template.name || ' - ' || client.name,
  'Obrigacao Grow' || E'\nCompetencia: ' || instance.competence_label,
  template.sector,
  client.name,
  instance.current_assignee,
  CASE
    WHEN instance.current_assignee::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN instance.current_assignee::uuid
    ELSE NULL
  END,
  instance.priority,
  CASE
    WHEN instance.status = 'concluida' THEN 'done'
    WHEN instance.status = 'em_revisao' THEN 'review'
    WHEN instance.status = 'em_andamento' THEN 'doing'
    WHEN instance.status = 'atrasada' THEN 'todo'
    ELSE 'backlog'
  END,
  instance.technical_due_date,
  'grow_obligation_task',
  'instance:' || instance.id::text,
  jsonb_build_object(
    'instance_id', instance.id,
    'template_id', template.id,
    'profile_id', instance.profile_id
  )
FROM public.obligation_instances instance
JOIN public.obligation_templates template ON template.id = instance.template_id
JOIN public.clients client ON client.id = instance.client_id
WHERE instance.organization_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.kanban_tasks task
    WHERE task.organization_id = instance.organization_id
      AND task.integration_source = 'grow_obligation_task'
      AND task.integration_task_id = 'instance:' || instance.id::text
  );
