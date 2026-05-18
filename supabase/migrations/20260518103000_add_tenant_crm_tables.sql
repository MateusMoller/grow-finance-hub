-- Tenant-aware CRM persistence.
-- Keeps the existing CRM UX but moves leads/goals out of browser localStorage.

CREATE TABLE IF NOT EXISTS public.crm_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE DEFAULT public.default_organization_id(),
  name text NOT NULL,
  contact text,
  email text,
  phone text,
  estimated_value numeric(14, 2) NOT NULL DEFAULT 0,
  stage text NOT NULL DEFAULT 'Oportunidade Nova',
  competence text NOT NULL,
  source text,
  notes text,
  external_source text,
  external_id text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS crm_leads_external_source_id_key
  ON public.crm_leads (organization_id, external_source, external_id);

CREATE INDEX IF NOT EXISTS idx_crm_leads_organization_stage
  ON public.crm_leads (organization_id, stage);

CREATE INDEX IF NOT EXISTS idx_crm_leads_organization_competence
  ON public.crm_leads (organization_id, competence);

CREATE INDEX IF NOT EXISTS idx_crm_leads_organization_updated_at
  ON public.crm_leads (organization_id, updated_at DESC);

DROP TRIGGER IF EXISTS update_crm_leads_updated_at ON public.crm_leads;
CREATE TRIGGER update_crm_leads_updated_at
  BEFORE UPDATE ON public.crm_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.crm_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE DEFAULT public.default_organization_id(),
  competence text NOT NULL DEFAULT 'default',
  won_revenue numeric(14, 2) NOT NULL DEFAULT 25000,
  won_deals integer NOT NULL DEFAULT 8,
  conversion_rate integer NOT NULL DEFAULT 40,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_goals_conversion_rate_check CHECK (conversion_rate BETWEEN 1 AND 100),
  CONSTRAINT crm_goals_won_deals_check CHECK (won_deals > 0),
  CONSTRAINT crm_goals_won_revenue_check CHECK (won_revenue > 0)
);

ALTER TABLE public.crm_goals ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS crm_goals_organization_competence_key
  ON public.crm_goals (organization_id, competence);

DROP TRIGGER IF EXISTS update_crm_goals_updated_at ON public.crm_goals;
CREATE TRIGGER update_crm_goals_updated_at
  BEFORE UPDATE ON public.crm_goals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.crm_lead_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE DEFAULT public.default_organization_id(),
  lead_id uuid NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_lead_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_crm_lead_events_organization_lead
  ON public.crm_lead_events (organization_id, lead_id, created_at DESC);

DROP POLICY IF EXISTS "Tenant internal can view crm leads" ON public.crm_leads;
CREATE POLICY "Tenant internal can view crm leads"
  ON public.crm_leads
  FOR SELECT
  TO authenticated
  USING (public.is_internal_user(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Tenant internal can insert crm leads" ON public.crm_leads;
CREATE POLICY "Tenant internal can insert crm leads"
  ON public.crm_leads
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_internal_user(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Tenant internal can update crm leads" ON public.crm_leads;
CREATE POLICY "Tenant internal can update crm leads"
  ON public.crm_leads
  FOR UPDATE
  TO authenticated
  USING (public.is_internal_user(auth.uid(), organization_id))
  WITH CHECK (public.is_internal_user(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Tenant managers can delete crm leads" ON public.crm_leads;
CREATE POLICY "Tenant managers can delete crm leads"
  ON public.crm_leads
  FOR DELETE
  TO authenticated
  USING (
    public.has_org_role(auth.uid(), organization_id, 'admin')
    OR public.has_org_role(auth.uid(), organization_id, 'director')
    OR public.has_org_role(auth.uid(), organization_id, 'manager')
    OR public.has_org_role(auth.uid(), organization_id, 'commercial')
  );

DROP POLICY IF EXISTS "Tenant internal can view crm goals" ON public.crm_goals;
CREATE POLICY "Tenant internal can view crm goals"
  ON public.crm_goals
  FOR SELECT
  TO authenticated
  USING (public.is_internal_user(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Tenant managers can manage crm goals" ON public.crm_goals;
CREATE POLICY "Tenant managers can manage crm goals"
  ON public.crm_goals
  FOR ALL
  TO authenticated
  USING (
    public.has_org_role(auth.uid(), organization_id, 'admin')
    OR public.has_org_role(auth.uid(), organization_id, 'director')
    OR public.has_org_role(auth.uid(), organization_id, 'manager')
    OR public.has_org_role(auth.uid(), organization_id, 'commercial')
  )
  WITH CHECK (
    public.has_org_role(auth.uid(), organization_id, 'admin')
    OR public.has_org_role(auth.uid(), organization_id, 'director')
    OR public.has_org_role(auth.uid(), organization_id, 'manager')
    OR public.has_org_role(auth.uid(), organization_id, 'commercial')
  );

DROP POLICY IF EXISTS "Tenant internal can view crm lead events" ON public.crm_lead_events;
CREATE POLICY "Tenant internal can view crm lead events"
  ON public.crm_lead_events
  FOR SELECT
  TO authenticated
  USING (public.is_internal_user(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Tenant internal can insert crm lead events" ON public.crm_lead_events;
CREATE POLICY "Tenant internal can insert crm lead events"
  ON public.crm_lead_events
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_internal_user(auth.uid(), organization_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_leads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_goals TO authenticated;
GRANT SELECT, INSERT ON public.crm_lead_events TO authenticated;
