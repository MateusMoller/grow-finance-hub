CREATE TABLE public.obligation_document_access_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  instance_id uuid NOT NULL REFERENCES public.obligation_instances(id) ON DELETE CASCADE,
  file_id uuid NOT NULL REFERENCES public.obligation_instance_files(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_email text,
  access_type text NOT NULL DEFAULT 'download'
    CHECK (access_type IN ('view', 'download')),
  access_channel text NOT NULL DEFAULT 'portal'
    CHECK (access_channel IN ('portal', 'email_link', 'whatsapp_link', 'direct_link')),
  source_context text,
  user_agent text,
  referrer text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  accessed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_obligation_document_access_instance
  ON public.obligation_document_access_events (organization_id, instance_id, accessed_at DESC);
CREATE INDEX idx_obligation_document_access_file
  ON public.obligation_document_access_events (file_id, accessed_at DESC);
CREATE INDEX idx_obligation_document_access_client
  ON public.obligation_document_access_events (client_id, accessed_at DESC);

CREATE TABLE public.obligation_document_delivery_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  instance_id uuid NOT NULL REFERENCES public.obligation_instances(id) ON DELETE CASCADE,
  file_id uuid NOT NULL REFERENCES public.obligation_instance_files(id) ON DELETE CASCADE,
  delivery_attempt_id uuid NOT NULL REFERENCES public.obligation_delivery_attempts(id) ON DELETE CASCADE,
  token_digest text NOT NULL UNIQUE,
  recipient_email text NOT NULL,
  access_channel text NOT NULL DEFAULT 'email_link'
    CHECK (access_channel IN ('email_link', 'whatsapp_link', 'direct_link')),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_obligation_document_delivery_links_attempt
  ON public.obligation_document_delivery_links (delivery_attempt_id);
CREATE INDEX idx_obligation_document_delivery_links_expiry
  ON public.obligation_document_delivery_links (expires_at)
  WHERE revoked_at IS NULL;

ALTER TABLE public.obligation_document_delivery_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.obligation_document_delivery_links FROM anon, authenticated;
GRANT ALL ON public.obligation_document_delivery_links TO service_role;

ALTER TABLE public.obligation_document_access_events ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.obligation_document_access_events TO authenticated;
GRANT ALL ON public.obligation_document_access_events TO service_role;

CREATE POLICY "Tenant internal can view document access"
  ON public.obligation_document_access_events
  FOR SELECT TO authenticated
  USING (public.is_internal_user((select auth.uid()), organization_id));

CREATE POLICY "Portal clients can register own document access"
  ON public.obligation_document_access_events
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND public.can_access_client((select auth.uid()), client_id)
    AND EXISTS (
      SELECT 1
      FROM public.obligation_instance_files oif
      JOIN public.obligation_instances oi ON oi.id = oif.instance_id
      WHERE oif.id = obligation_document_access_events.file_id
        AND oif.instance_id = obligation_document_access_events.instance_id
        AND oif.organization_id = obligation_document_access_events.organization_id
        AND oi.id = obligation_document_access_events.instance_id
        AND oi.client_id = obligation_document_access_events.client_id
        AND oi.organization_id = obligation_document_access_events.organization_id
    )
  );
