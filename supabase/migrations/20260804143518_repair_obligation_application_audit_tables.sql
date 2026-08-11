-- Repair a partial production migration: regime loads existed, but the
-- reconciliation/audit tables used by grow-obligations-module did not.

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
  auto_applied boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT obligation_load_application_reviews_decision_check
    CHECK (decision_type IN ('add', 'keep', 'reactivate', 'suggest_inactivate', 'auto_inactivate_prior_regime', 'inactivate_prior_regime', 'skip', 'duplicate_risk', 'blocked')),
  CONSTRAINT obligation_load_application_reviews_sync_effect_check
    CHECK (sync_effect IN ('profile_only', 'future_only', 'no_change', 'blocked'))
);

CREATE TABLE IF NOT EXISTS public.obligation_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE DEFAULT public.default_organization_id(),
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  template_id uuid REFERENCES public.obligation_templates(id) ON DELETE SET NULL,
  entity_type text,
  entity_id uuid,
  action text NOT NULL,
  actor_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_obligation_load_application_batches_org_client_created
  ON public.obligation_load_application_batches (organization_id, client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_obligation_load_application_reviews_org_client_created
  ON public.obligation_load_application_reviews (organization_id, client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_obligation_audit_events_org_entity_created
  ON public.obligation_audit_events (organization_id, entity_type, entity_id, created_at DESC);

ALTER TABLE public.obligation_load_application_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obligation_load_application_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obligation_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal can view obligation application records" ON public.obligation_load_application_batches;
CREATE POLICY "Internal can view obligation application records"
  ON public.obligation_load_application_batches FOR SELECT TO authenticated
  USING (public.is_internal_user(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Internal can view obligation application reviews" ON public.obligation_load_application_reviews;
CREATE POLICY "Internal can view obligation application reviews"
  ON public.obligation_load_application_reviews FOR SELECT TO authenticated
  USING (public.is_internal_user(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Internal can view obligation audit events" ON public.obligation_audit_events;
CREATE POLICY "Internal can view obligation audit events"
  ON public.obligation_audit_events FOR SELECT TO authenticated
  USING (public.is_internal_user(auth.uid(), organization_id));

GRANT SELECT ON public.obligation_load_application_batches TO authenticated;
GRANT SELECT ON public.obligation_load_application_reviews TO authenticated;
GRANT SELECT ON public.obligation_audit_events TO authenticated;
GRANT ALL ON public.obligation_load_application_batches TO service_role;
GRANT ALL ON public.obligation_load_application_reviews TO service_role;
GRANT ALL ON public.obligation_audit_events TO service_role;
