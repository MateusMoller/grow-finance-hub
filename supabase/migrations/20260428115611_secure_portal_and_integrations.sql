CREATE TABLE IF NOT EXISTS public.integration_api_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  token_prefix text,
  enabled boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.integration_api_credentials ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_integration_api_credentials_updated_at ON public.integration_api_credentials;
CREATE TRIGGER update_integration_api_credentials_updated_at
  BEFORE UPDATE ON public.integration_api_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_settings'
      AND column_name = 'api_token'
  ) OR EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_settings'
      AND column_name = 'integrations_api_token'
  ) THEN
    EXECUTE $sql$
      INSERT INTO public.integration_api_credentials (
        user_id,
        token_hash,
        token_prefix,
        enabled,
        created_at,
        updated_at
      )
      SELECT
        us.user_id,
        encode(extensions.digest(token_source.token_value, 'sha256'), 'hex'),
        left(token_source.token_value, 12),
        coalesce(
          nullif((to_jsonb(us)->>'api_access'), '')::boolean,
          nullif((to_jsonb(us)->>'integrations_api_access'), '')::boolean,
          true
        ),
        now(),
        now()
      FROM public.user_settings us
      CROSS JOIN LATERAL (
        SELECT coalesce(
          nullif(trim(coalesce(to_jsonb(us)->>'api_token', '')), ''),
          nullif(trim(coalesce(to_jsonb(us)->>'integrations_api_token', '')), '')
        ) AS token_value
      ) AS token_source
      WHERE token_source.token_value IS NOT NULL
      ON CONFLICT (user_id) DO UPDATE
      SET
        token_hash = excluded.token_hash,
        token_prefix = excluded.token_prefix,
        enabled = excluded.enabled,
        revoked_at = CASE WHEN excluded.enabled THEN NULL ELSE public.integration_api_credentials.revoked_at END,
        updated_at = now()
    $sql$;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_settings'
      AND column_name = 'api_token'
  ) THEN
    EXECUTE 'UPDATE public.user_settings SET api_token = NULL WHERE api_token IS NOT NULL';
    EXECUTE 'ALTER TABLE public.user_settings DROP COLUMN api_token';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_settings'
      AND column_name = 'integrations_api_token'
  ) THEN
    EXECUTE 'UPDATE public.user_settings SET integrations_api_token = NULL WHERE integrations_api_token IS NOT NULL';
    EXECUTE 'ALTER TABLE public.user_settings DROP COLUMN integrations_api_token';
  END IF;
END
$$;

DROP POLICY IF EXISTS "Clients and internal can update portal tasks" ON public.client_portal_tasks;
CREATE POLICY "Internal team can update portal tasks"
  ON public.client_portal_tasks
  FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'director')
    OR has_role(auth.uid(), 'manager')
    OR has_role(auth.uid(), 'employee')
    OR has_role(auth.uid(), 'commercial')
    OR has_role(auth.uid(), 'partner')
    OR has_role(auth.uid(), 'departamento_pessoal')
    OR has_role(auth.uid(), 'fiscal')
    OR has_role(auth.uid(), 'contabil')
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'director')
    OR has_role(auth.uid(), 'manager')
    OR has_role(auth.uid(), 'employee')
    OR has_role(auth.uid(), 'commercial')
    OR has_role(auth.uid(), 'partner')
    OR has_role(auth.uid(), 'departamento_pessoal')
    OR has_role(auth.uid(), 'fiscal')
    OR has_role(auth.uid(), 'contabil')
  );

ALTER VIEW public.acessorias_report_overview SET (security_invoker = true);
REVOKE ALL PRIVILEGES ON TABLE public.acessorias_report_overview FROM anon, authenticated;

UPDATE storage.buckets
SET
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'text/plain'
  ]::text[]
WHERE id IN ('client-documents', 'client-files');
