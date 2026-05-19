ALTER TABLE public.site_leads
  ADD COLUMN IF NOT EXISTS organization_id uuid DEFAULT public.default_organization_id();

UPDATE public.site_leads
SET organization_id = public.default_organization_id()
WHERE organization_id IS NULL
  AND public.default_organization_id() IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_site_leads_organization_id
  ON public.site_leads (organization_id);

CREATE TABLE IF NOT EXISTS public.crm_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.default_organization_id(),
  name text NOT NULL,
  contact text,
  email text,
  phone text,
  estimated_value numeric NOT NULL DEFAULT 0,
  stage text NOT NULL,
  competence text,
  source text,
  notes text,
  external_source text,
  external_id text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_leads_org_external_key
  ON public.crm_leads (organization_id, external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_leads_org_stage
  ON public.crm_leads (organization_id, stage);

CREATE INDEX IF NOT EXISTS idx_crm_leads_org_updated_at
  ON public.crm_leads (organization_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.crm_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.default_organization_id(),
  competence text NOT NULL DEFAULT 'default',
  won_revenue numeric NOT NULL DEFAULT 0,
  won_deals integer NOT NULL DEFAULT 0,
  conversion_rate numeric NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_goals_org_competence_key
  ON public.crm_goals (organization_id, competence);

CREATE TABLE IF NOT EXISTS public.crm_lead_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.default_organization_id(),
  lead_id uuid REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_lead_events_org_lead_created_at
  ON public.crm_lead_events (organization_id, lead_id, created_at DESC);

ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_lead_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal can view crm leads" ON public.crm_leads;
CREATE POLICY "Internal can view crm leads"
ON public.crm_leads FOR SELECT TO authenticated
USING (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "Internal can manage crm leads" ON public.crm_leads;
CREATE POLICY "Internal can manage crm leads"
ON public.crm_leads FOR ALL TO authenticated
USING (public.is_internal_user(auth.uid()))
WITH CHECK (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "Internal can view crm goals" ON public.crm_goals;
CREATE POLICY "Internal can view crm goals"
ON public.crm_goals FOR SELECT TO authenticated
USING (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "Internal can manage crm goals" ON public.crm_goals;
CREATE POLICY "Internal can manage crm goals"
ON public.crm_goals FOR ALL TO authenticated
USING (public.is_internal_user(auth.uid()))
WITH CHECK (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "Internal can view crm lead events" ON public.crm_lead_events;
CREATE POLICY "Internal can view crm lead events"
ON public.crm_lead_events FOR SELECT TO authenticated
USING (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "Internal can insert crm lead events" ON public.crm_lead_events;
CREATE POLICY "Internal can insert crm lead events"
ON public.crm_lead_events FOR INSERT TO authenticated
WITH CHECK (public.is_internal_user(auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_leads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_goals TO authenticated;
GRANT SELECT, INSERT ON public.crm_lead_events TO authenticated;
