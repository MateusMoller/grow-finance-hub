-- Acessorias module: client cross-link, obligations sync cache, and e-Continuo upload logs.

CREATE TABLE IF NOT EXISTS public.acessorias_companies_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acessorias_company_id text NOT NULL UNIQUE,
  cnpj text,
  company_name text NOT NULL,
  status text,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_acessorias_companies_cache_cnpj
  ON public.acessorias_companies_cache (cnpj);

ALTER TABLE public.acessorias_companies_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal can view acessorias companies cache" ON public.acessorias_companies_cache;
DROP POLICY IF EXISTS "Internal can insert acessorias companies cache" ON public.acessorias_companies_cache;
DROP POLICY IF EXISTS "Internal can update acessorias companies cache" ON public.acessorias_companies_cache;

CREATE POLICY "Internal can view acessorias companies cache"
  ON public.acessorias_companies_cache
  FOR SELECT
  TO authenticated
  USING (public.is_internal_user(auth.uid()));

CREATE POLICY "Internal can insert acessorias companies cache"
  ON public.acessorias_companies_cache
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_internal_user(auth.uid()));

CREATE POLICY "Internal can update acessorias companies cache"
  ON public.acessorias_companies_cache
  FOR UPDATE
  TO authenticated
  USING (public.is_internal_user(auth.uid()))
  WITH CHECK (public.is_internal_user(auth.uid()));

DROP TRIGGER IF EXISTS update_acessorias_companies_cache_updated_at ON public.acessorias_companies_cache;
CREATE TRIGGER update_acessorias_companies_cache_updated_at
  BEFORE UPDATE ON public.acessorias_companies_cache
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.client_acessorias_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE UNIQUE,
  acessorias_company_id text NOT NULL UNIQUE,
  match_type text NOT NULL DEFAULT 'manual',
  match_score numeric(5,2),
  notes text,
  created_by uuid,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_acessorias_links_client_id
  ON public.client_acessorias_links (client_id);

CREATE INDEX IF NOT EXISTS idx_client_acessorias_links_company_id
  ON public.client_acessorias_links (acessorias_company_id);

ALTER TABLE public.client_acessorias_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal can view client acessorias links" ON public.client_acessorias_links;
DROP POLICY IF EXISTS "Internal can insert client acessorias links" ON public.client_acessorias_links;
DROP POLICY IF EXISTS "Internal can update client acessorias links" ON public.client_acessorias_links;
DROP POLICY IF EXISTS "Internal can delete client acessorias links" ON public.client_acessorias_links;

CREATE POLICY "Internal can view client acessorias links"
  ON public.client_acessorias_links
  FOR SELECT
  TO authenticated
  USING (public.is_internal_user(auth.uid()));

CREATE POLICY "Internal can insert client acessorias links"
  ON public.client_acessorias_links
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_internal_user(auth.uid()));

CREATE POLICY "Internal can update client acessorias links"
  ON public.client_acessorias_links
  FOR UPDATE
  TO authenticated
  USING (public.is_internal_user(auth.uid()))
  WITH CHECK (public.is_internal_user(auth.uid()));

CREATE POLICY "Internal can delete client acessorias links"
  ON public.client_acessorias_links
  FOR DELETE
  TO authenticated
  USING (public.is_internal_user(auth.uid()));

DROP TRIGGER IF EXISTS update_client_acessorias_links_updated_at ON public.client_acessorias_links;
CREATE TRIGGER update_client_acessorias_links_updated_at
  BEFORE UPDATE ON public.client_acessorias_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.client_acessorias_obligations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  acessorias_company_id text,
  acessorias_obligation_id text NOT NULL,
  obligation_name text NOT NULL,
  obligation_period text,
  obligation_period_key text NOT NULL DEFAULT '',
  due_date date,
  delivered_at timestamptz,
  status text,
  protocol text,
  notes text,
  source_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_acessorias_obligations_unique
    UNIQUE (client_id, acessorias_obligation_id, obligation_period_key)
);

CREATE INDEX IF NOT EXISTS idx_client_acessorias_obligations_client_id
  ON public.client_acessorias_obligations (client_id);

CREATE INDEX IF NOT EXISTS idx_client_acessorias_obligations_due_date
  ON public.client_acessorias_obligations (due_date);

CREATE INDEX IF NOT EXISTS idx_client_acessorias_obligations_status
  ON public.client_acessorias_obligations (status);

ALTER TABLE public.client_acessorias_obligations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal can view client acessorias obligations" ON public.client_acessorias_obligations;
DROP POLICY IF EXISTS "Internal can insert client acessorias obligations" ON public.client_acessorias_obligations;
DROP POLICY IF EXISTS "Internal can update client acessorias obligations" ON public.client_acessorias_obligations;
DROP POLICY IF EXISTS "Internal can delete client acessorias obligations" ON public.client_acessorias_obligations;

CREATE POLICY "Internal can view client acessorias obligations"
  ON public.client_acessorias_obligations
  FOR SELECT
  TO authenticated
  USING (public.is_internal_user(auth.uid()));

CREATE POLICY "Internal can insert client acessorias obligations"
  ON public.client_acessorias_obligations
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_internal_user(auth.uid()));

CREATE POLICY "Internal can update client acessorias obligations"
  ON public.client_acessorias_obligations
  FOR UPDATE
  TO authenticated
  USING (public.is_internal_user(auth.uid()))
  WITH CHECK (public.is_internal_user(auth.uid()));

CREATE POLICY "Internal can delete client acessorias obligations"
  ON public.client_acessorias_obligations
  FOR DELETE
  TO authenticated
  USING (public.is_internal_user(auth.uid()));

DROP TRIGGER IF EXISTS update_client_acessorias_obligations_updated_at ON public.client_acessorias_obligations;
CREATE TRIGGER update_client_acessorias_obligations_updated_at
  BEFORE UPDATE ON public.client_acessorias_obligations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.client_acessorias_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  acessorias_company_id text,
  file_name text NOT NULL,
  file_size bigint,
  content_type text,
  status text NOT NULL DEFAULT 'pending',
  request_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  uploaded_by uuid,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_acessorias_uploads_client_id
  ON public.client_acessorias_uploads (client_id);

CREATE INDEX IF NOT EXISTS idx_client_acessorias_uploads_uploaded_at
  ON public.client_acessorias_uploads (uploaded_at DESC);

ALTER TABLE public.client_acessorias_uploads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal can view client acessorias uploads" ON public.client_acessorias_uploads;
DROP POLICY IF EXISTS "Internal can insert client acessorias uploads" ON public.client_acessorias_uploads;
DROP POLICY IF EXISTS "Internal can update client acessorias uploads" ON public.client_acessorias_uploads;

CREATE POLICY "Internal can view client acessorias uploads"
  ON public.client_acessorias_uploads
  FOR SELECT
  TO authenticated
  USING (public.is_internal_user(auth.uid()));

CREATE POLICY "Internal can insert client acessorias uploads"
  ON public.client_acessorias_uploads
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_internal_user(auth.uid()));

CREATE POLICY "Internal can update client acessorias uploads"
  ON public.client_acessorias_uploads
  FOR UPDATE
  TO authenticated
  USING (public.is_internal_user(auth.uid()))
  WITH CHECK (public.is_internal_user(auth.uid()));

CREATE OR REPLACE VIEW public.acessorias_report_overview AS
SELECT
  c.id AS client_id,
  c.name AS client_name,
  c.cnpj AS client_cnpj,
  c.status AS client_status,
  l.acessorias_company_id,
  co.company_name AS acessorias_company_name,
  co.status AS acessorias_company_status,
  l.match_type,
  l.last_synced_at AS link_last_synced_at,
  COUNT(o.id) AS obligations_total,
  COUNT(o.id) FILTER (
    WHERE lower(coalesce(o.status, '')) IN (
      'pendente',
      'pending',
      'atrasado',
      'overdue',
      'em_aberto',
      'open',
      'a_enviar',
      'to_send'
    )
  ) AS obligations_pending,
  COUNT(o.id) FILTER (
    WHERE o.due_date IS NOT NULL
      AND o.due_date < CURRENT_DATE
      AND lower(coalesce(o.status, '')) NOT IN (
        'enviado',
        'sent',
        'concluido',
        'concluida',
        'completed',
        'done',
        'entregue',
        'delivered'
      )
  ) AS obligations_overdue,
  MAX(o.last_synced_at) AS obligations_last_synced_at
FROM public.clients c
LEFT JOIN public.client_acessorias_links l
  ON l.client_id = c.id
LEFT JOIN public.acessorias_companies_cache co
  ON co.acessorias_company_id = l.acessorias_company_id
LEFT JOIN public.client_acessorias_obligations o
  ON o.client_id = c.id
GROUP BY
  c.id,
  c.name,
  c.cnpj,
  c.status,
  l.acessorias_company_id,
  co.company_name,
  co.status,
  l.match_type,
  l.last_synced_at;
