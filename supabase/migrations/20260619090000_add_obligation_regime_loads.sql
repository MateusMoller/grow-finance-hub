-- Governed obligation regime loads.

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;

ALTER TABLE public.obligation_templates
  ADD COLUMN IF NOT EXISTS normalized_name text,
  ADD COLUMN IF NOT EXISTS duplicate_group_key text,
  ADD COLUMN IF NOT EXISTS baseline_source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS catalog_review_status text NOT NULL DEFAULT 'approved';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'obligation_templates_code_key'
      AND conrelid = 'public.obligation_templates'::regclass
  ) THEN
    ALTER TABLE public.obligation_templates
      DROP CONSTRAINT obligation_templates_code_key;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'obligation_templates_organization_code_key'
      AND conrelid = 'public.obligation_templates'::regclass
  ) THEN
    ALTER TABLE public.obligation_templates
      ADD CONSTRAINT obligation_templates_organization_code_key UNIQUE (organization_id, code);
  END IF;
END $$;

UPDATE public.obligation_templates
SET normalized_name = lower(regexp_replace(unaccent(coalesce(name, '')), '[^a-zA-Z0-9]+', ' ', 'g'))
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

CREATE TABLE IF NOT EXISTS public.obligation_load_application_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE DEFAULT public.default_organization_id(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  tax_regime_code text NOT NULL,
  load_id uuid REFERENCES public.obligation_regime_loads(id) ON DELETE SET NULL,
  mode text NOT NULL,
  sync_scope text NOT NULL DEFAULT 'single_client',
  status text NOT NULL DEFAULT 'previewed',
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  applied_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  applied_at timestamptz,
  CONSTRAINT obligation_load_application_batches_mode_check
    CHECK (mode IN ('new_client', 'manual_apply', 'regime_migration', 'reconcile_existing', 'standard_load_sync')),
  CONSTRAINT obligation_load_application_batches_scope_check
    CHECK (sync_scope IN ('single_client', 'existing_clients_same_regime', 'branch_inherited_regime')),
  CONSTRAINT obligation_load_application_batches_status_check
    CHECK (status IN ('previewed', 'applied', 'failed', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS public.obligation_load_application_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE DEFAULT public.default_organization_id(),
  batch_id uuid NOT NULL REFERENCES public.obligation_load_application_batches(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.obligation_templates(id) ON DELETE SET NULL,
  load_item_id uuid REFERENCES public.obligation_regime_load_items(id) ON DELETE SET NULL,
  decision_type text NOT NULL,
  current_profile_id uuid REFERENCES public.client_obligation_profiles(id) ON DELETE SET NULL,
  reason text NOT NULL,
  requires_confirmation boolean NOT NULL DEFAULT false,
  selected boolean NOT NULL DEFAULT true,
  evidence_source text,
  sync_effect text NOT NULL DEFAULT 'profile_only',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT obligation_load_application_reviews_decision_check
    CHECK (decision_type IN ('add', 'keep', 'reactivate', 'suggest_inactivate', 'skip', 'duplicate_risk', 'blocked')),
  CONSTRAINT obligation_load_application_reviews_sync_effect_check
    CHECK (sync_effect IN ('profile_only', 'future_only', 'no_change', 'blocked'))
);

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

CREATE TABLE IF NOT EXISTS public.obligation_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE DEFAULT public.default_organization_id(),
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  actor_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT obligation_audit_events_entity_type_check
    CHECK (entity_type IN ('template', 'regime_load', 'load_item', 'client_profile', 'application_batch', 'sync_run'))
);

CREATE INDEX IF NOT EXISTS idx_obligation_templates_org_code
  ON public.obligation_templates (organization_id, code);
CREATE INDEX IF NOT EXISTS idx_obligation_templates_org_normalized_name
ON public.obligation_templates (organization_id, normalized_name);
CREATE INDEX IF NOT EXISTS idx_obligation_regime_loads_org_regime_status
  ON public.obligation_regime_loads (organization_id, tax_regime_code, status);
CREATE INDEX IF NOT EXISTS idx_obligation_regime_load_items_org_load_template
  ON public.obligation_regime_load_items (organization_id, load_id, template_id);
CREATE INDEX IF NOT EXISTS idx_client_obligation_profiles_org_client_template
  ON public.client_obligation_profiles (organization_id, client_id, template_id);
CREATE INDEX IF NOT EXISTS idx_obligation_load_application_batches_org_client_created
  ON public.obligation_load_application_batches (organization_id, client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_obligation_load_sync_runs_org_load_status_started
  ON public.obligation_load_sync_runs (organization_id, load_id, status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_obligation_audit_events_org_entity_created
  ON public.obligation_audit_events (organization_id, entity_type, entity_id, created_at DESC);

ALTER TABLE public.tax_regime_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obligation_regime_loads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obligation_regime_load_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obligation_load_application_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obligation_load_application_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obligation_load_sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obligation_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal can view tax regime definitions" ON public.tax_regime_definitions;
CREATE POLICY "Internal can view tax regime definitions"
  ON public.tax_regime_definitions FOR SELECT TO authenticated
  USING (public.is_internal_user(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Managers can manage tax regime definitions" ON public.tax_regime_definitions;
CREATE POLICY "Managers can manage tax regime definitions"
  ON public.tax_regime_definitions FOR ALL TO authenticated
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

DROP POLICY IF EXISTS "Internal can view obligation regime loads" ON public.obligation_regime_loads;
CREATE POLICY "Internal can view obligation regime loads"
  ON public.obligation_regime_loads FOR SELECT TO authenticated
  USING (public.is_internal_user(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Managers can manage obligation regime loads" ON public.obligation_regime_loads;
CREATE POLICY "Managers can manage obligation regime loads"
  ON public.obligation_regime_loads FOR ALL TO authenticated
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

DROP POLICY IF EXISTS "Internal can view obligation regime load items" ON public.obligation_regime_load_items;
CREATE POLICY "Internal can view obligation regime load items"
  ON public.obligation_regime_load_items FOR SELECT TO authenticated
  USING (public.is_internal_user(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Managers can manage obligation regime load items" ON public.obligation_regime_load_items;
CREATE POLICY "Managers can manage obligation regime load items"
  ON public.obligation_regime_load_items FOR ALL TO authenticated
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

DROP POLICY IF EXISTS "Internal can view obligation application records" ON public.obligation_load_application_batches;
CREATE POLICY "Internal can view obligation application records"
  ON public.obligation_load_application_batches FOR SELECT TO authenticated
  USING (public.is_internal_user(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Internal can view obligation application reviews" ON public.obligation_load_application_reviews;
CREATE POLICY "Internal can view obligation application reviews"
  ON public.obligation_load_application_reviews FOR SELECT TO authenticated
  USING (public.is_internal_user(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Internal can view obligation sync runs" ON public.obligation_load_sync_runs;
CREATE POLICY "Internal can view obligation sync runs"
  ON public.obligation_load_sync_runs FOR SELECT TO authenticated
  USING (public.is_internal_user(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Internal can view obligation audit events" ON public.obligation_audit_events;
CREATE POLICY "Internal can view obligation audit events"
  ON public.obligation_audit_events FOR SELECT TO authenticated
  USING (public.is_internal_user(auth.uid(), organization_id));

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

INSERT INTO public.obligation_templates (
  organization_id,
  code,
  name,
  sector,
  periodicity,
  competence_reference,
  technical_due_month_reference,
  due_day,
  priority,
  expected_documents,
  is_active,
  generates_calendar,
  generates_kanban,
  requires_document,
  baseline_source,
  catalog_review_status,
  normalized_name
)
SELECT org.id, seed.code, seed.name, seed.sector, seed.periodicity, 'anterior', 'vigente', seed.due_day,
       'media', '[]'::jsonb, true, true, true, true, 'seed', 'approved',
       lower(regexp_replace(unaccent(seed.name), '[^a-zA-Z0-9]+', ' ', 'g'))
FROM public.organizations org
CROSS JOIN (
  VALUES
    ('fgts', 'FGTS', 'Departamento Pessoal', 'monthly', 20),
    ('esocial', 'eSocial', 'Departamento Pessoal', 'monthly', 15),
    ('dctfweb_mit', 'DCTFWeb/MIT', 'Fiscal', 'monthly', 25),
    ('efd_reinf', 'EFD-Reinf', 'Fiscal', 'monthly', 15),
    ('pgdas_d', 'PGDAS-D', 'Fiscal', 'monthly', 20),
    ('defis', 'DEFIS', 'Fiscal', 'yearly', 31),
    ('dasn_simei', 'DASN-SIMEI', 'Fiscal', 'yearly', 31),
    ('pgmei', 'PGMEI/DAS MEI', 'Fiscal', 'monthly', 20),
    ('dctf_mensal', 'DCTF Mensal', 'Fiscal', 'monthly', 15),
    ('efd_contribuicoes', 'EFD-Contribuicoes', 'Fiscal', 'monthly', 15),
    ('efd_icms_ipi', 'EFD ICMS/IPI', 'Fiscal', 'monthly', 20),
    ('ecd', 'ECD', 'Contabil', 'yearly', 31),
    ('ecf', 'ECF', 'Contabil', 'yearly', 31),
    ('iss_municipal', 'ISS Municipal', 'Fiscal', 'monthly', 10)
) AS seed(code, name, sector, periodicity, due_day)
ON CONFLICT (organization_id, code) DO UPDATE
SET name = EXCLUDED.name,
    sector = EXCLUDED.sector,
    normalized_name = EXCLUDED.normalized_name,
    baseline_source = 'seed',
    catalog_review_status = 'approved';

INSERT INTO public.obligation_regime_loads (organization_id, tax_regime_code, name, status, version, owner_sector)
SELECT org.id, seed.tax_regime_code, seed.name, 'active', 1, 'Fiscal'
FROM public.organizations org
CROSS JOIN (
  VALUES
    ('simples_nacional', 'Simples Nacional - Carga Padrao'),
    ('lucro_presumido', 'Lucro Presumido - Carga Padrao'),
    ('lucro_real', 'Lucro Real - Carga Padrao'),
    ('mei', 'MEI - Carga Padrao')
) AS seed(tax_regime_code, name)
ON CONFLICT DO NOTHING;

WITH load_items(tax_regime_code, template_code, applicability, condition_key, sort_order) AS (
  VALUES
    ('simples_nacional', 'pgdas_d', 'required', NULL, 10),
    ('simples_nacional', 'defis', 'required', NULL, 20),
    ('simples_nacional', 'fgts', 'conditional', 'has_employees', 30),
    ('simples_nacional', 'esocial', 'conditional', 'has_employees', 40),
    ('simples_nacional', 'dctfweb_mit', 'conditional', 'has_employees', 50),
    ('simples_nacional', 'iss_municipal', 'conditional', 'iss_applicable', 60),
    ('lucro_presumido', 'dctf_mensal', 'required', NULL, 10),
    ('lucro_presumido', 'dctfweb_mit', 'required', NULL, 20),
    ('lucro_presumido', 'efd_reinf', 'required', NULL, 30),
    ('lucro_presumido', 'ecd', 'required', NULL, 40),
    ('lucro_presumido', 'ecf', 'required', NULL, 50),
    ('lucro_presumido', 'efd_contribuicoes', 'conditional', 'service_provider', 60),
    ('lucro_presumido', 'efd_icms_ipi', 'conditional', 'icms_taxpayer', 70),
    ('lucro_presumido', 'fgts', 'conditional', 'has_employees', 80),
    ('lucro_presumido', 'esocial', 'conditional', 'has_employees', 90),
    ('lucro_presumido', 'iss_municipal', 'conditional', 'iss_applicable', 100),
    ('lucro_real', 'dctf_mensal', 'required', NULL, 10),
    ('lucro_real', 'dctfweb_mit', 'required', NULL, 20),
    ('lucro_real', 'efd_reinf', 'required', NULL, 30),
    ('lucro_real', 'ecd', 'required', NULL, 40),
    ('lucro_real', 'ecf', 'required', NULL, 50),
    ('lucro_real', 'efd_contribuicoes', 'required', NULL, 60),
    ('lucro_real', 'efd_icms_ipi', 'conditional', 'icms_taxpayer', 70),
    ('lucro_real', 'fgts', 'conditional', 'has_employees', 80),
    ('lucro_real', 'esocial', 'conditional', 'has_employees', 90),
    ('lucro_real', 'iss_municipal', 'conditional', 'iss_applicable', 100),
    ('mei', 'pgmei', 'required', NULL, 10),
    ('mei', 'dasn_simei', 'required', NULL, 20),
    ('mei', 'fgts', 'conditional', 'has_employees', 30),
    ('mei', 'esocial', 'conditional', 'has_employees', 40),
    ('mei', 'iss_municipal', 'conditional', 'iss_applicable', 50)
)
INSERT INTO public.obligation_regime_load_items (
  organization_id,
  load_id,
  template_id,
  applicability,
  condition_key,
  default_start_policy,
  sort_order
)
SELECT loads.organization_id, loads.id, templates.id, load_items.applicability, load_items.condition_key,
       'client_created_at', load_items.sort_order
FROM load_items
JOIN public.obligation_regime_loads loads
  ON loads.tax_regime_code = load_items.tax_regime_code
 AND loads.status = 'active'
JOIN public.obligation_templates templates
  ON templates.organization_id = loads.organization_id
 AND templates.code = load_items.template_code
ON CONFLICT DO NOTHING;
