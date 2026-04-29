CREATE TABLE IF NOT EXISTS public.ai_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel text NOT NULL,
  user_message text NOT NULL,
  ai_response text,
  detected_intent text,
  risk_level text NOT NULL DEFAULT 'baixo',
  action_requested jsonb NOT NULL DEFAULT '{}'::jsonb,
  action_executed jsonb NOT NULL DEFAULT '{}'::jsonb,
  requires_human_review boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_interactions_cliente_created_at
  ON public.ai_interactions (cliente_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_interactions_user_created_at
  ON public.ai_interactions (user_id, created_at DESC);

ALTER TABLE public.ai_interactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal can view ai interactions" ON public.ai_interactions;
DROP POLICY IF EXISTS "Client can view own ai interactions" ON public.ai_interactions;

CREATE POLICY "Internal can view ai interactions"
  ON public.ai_interactions
  FOR SELECT
  TO authenticated
  USING (public.is_internal_user(auth.uid()));

CREATE POLICY "Client can view own ai interactions"
  ON public.ai_interactions
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.clients c
      WHERE c.id = ai_interactions.cliente_id
        AND c.portal_user_id = auth.uid()
        AND public.has_role(auth.uid(), 'client'::public.app_role)
    )
  );

DROP TRIGGER IF EXISTS update_ai_interactions_updated_at ON public.ai_interactions;
CREATE TRIGGER update_ai_interactions_updated_at
  BEFORE UPDATE ON public.ai_interactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.ai_action_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  action_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  action_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_action_logs_cliente_created_at
  ON public.ai_action_logs (cliente_id, created_at DESC);

ALTER TABLE public.ai_action_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal can view ai action logs" ON public.ai_action_logs;
DROP POLICY IF EXISTS "Client can view own ai action logs" ON public.ai_action_logs;

CREATE POLICY "Internal can view ai action logs"
  ON public.ai_action_logs
  FOR SELECT
  TO authenticated
  USING (public.is_internal_user(auth.uid()));

CREATE POLICY "Client can view own ai action logs"
  ON public.ai_action_logs
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.clients c
      WHERE c.id = ai_action_logs.cliente_id
        AND c.portal_user_id = auth.uid()
        AND public.has_role(auth.uid(), 'client'::public.app_role)
    )
  );

CREATE TABLE IF NOT EXISTS public.ai_duplicate_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  source_id text,
  matched_type text,
  matched_id text,
  confidence_level text NOT NULL DEFAULT 'baixo',
  reason text,
  recommended_action text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_duplicate_checks_cliente_created_at
  ON public.ai_duplicate_checks (cliente_id, created_at DESC);

ALTER TABLE public.ai_duplicate_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal can view ai duplicate checks" ON public.ai_duplicate_checks;

CREATE POLICY "Internal can view ai duplicate checks"
  ON public.ai_duplicate_checks
  FOR SELECT
  TO authenticated
  USING (public.is_internal_user(auth.uid()));
