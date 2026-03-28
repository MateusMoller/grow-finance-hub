CREATE TABLE IF NOT EXISTS public.email_inbox_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email text NOT NULL,
  from_email text NOT NULL,
  subject text NOT NULL DEFAULT '(sem assunto)',
  preview text,
  text_content text,
  html_content text,
  provider text NOT NULL DEFAULT 'generic_webhook',
  provider_message_id text,
  source_payload jsonb,
  read_at timestamptz,
  received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (to_email = lower(to_email)),
  CHECK (from_email = lower(from_email))
);

CREATE INDEX IF NOT EXISTS email_inbox_messages_to_email_received_at_idx
  ON public.email_inbox_messages (to_email, received_at DESC);

CREATE INDEX IF NOT EXISTS email_inbox_messages_unread_idx
  ON public.email_inbox_messages (to_email)
  WHERE read_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS email_inbox_messages_provider_message_key
  ON public.email_inbox_messages (provider, provider_message_id, to_email)
  WHERE provider_message_id IS NOT NULL;

ALTER TABLE public.email_inbox_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team can read own inbox messages" ON public.email_inbox_messages;
CREATE POLICY "Team can read own inbox messages"
ON public.email_inbox_messages
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  OR lower(COALESCE(auth.jwt() ->> 'email', '')) = to_email
  OR EXISTS (
    SELECT 1
    FROM public.user_settings us
    WHERE us.user_id = auth.uid()
      AND us.company_email IS NOT NULL
      AND lower(us.company_email) = public.email_inbox_messages.to_email
  )
);

DROP POLICY IF EXISTS "Team can update own inbox messages" ON public.email_inbox_messages;
CREATE POLICY "Team can update own inbox messages"
ON public.email_inbox_messages
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  OR lower(COALESCE(auth.jwt() ->> 'email', '')) = to_email
  OR EXISTS (
    SELECT 1
    FROM public.user_settings us
    WHERE us.user_id = auth.uid()
      AND us.company_email IS NOT NULL
      AND lower(us.company_email) = public.email_inbox_messages.to_email
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin')
  OR lower(COALESCE(auth.jwt() ->> 'email', '')) = to_email
  OR EXISTS (
    SELECT 1
    FROM public.user_settings us
    WHERE us.user_id = auth.uid()
      AND us.company_email IS NOT NULL
      AND lower(us.company_email) = public.email_inbox_messages.to_email
  )
);
