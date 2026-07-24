CREATE TABLE IF NOT EXISTS public.internal_chat_message_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES public.internal_chat_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT internal_chat_message_reads_unique UNIQUE (organization_id, message_id, user_id)
);

CREATE INDEX IF NOT EXISTS internal_chat_message_reads_message_idx
  ON public.internal_chat_message_reads (message_id, read_at DESC);

CREATE INDEX IF NOT EXISTS internal_chat_message_reads_user_idx
  ON public.internal_chat_message_reads (organization_id, user_id, read_at DESC);

ALTER TABLE public.internal_chat_message_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal team can view internal chat reads" ON public.internal_chat_message_reads;
DROP POLICY IF EXISTS "Internal team can insert own internal chat reads" ON public.internal_chat_message_reads;
DROP POLICY IF EXISTS "Internal team can update own internal chat reads" ON public.internal_chat_message_reads;

CREATE POLICY "Internal team can view internal chat reads"
  ON public.internal_chat_message_reads FOR SELECT TO authenticated
  USING (
    public.is_internal_user((select auth.uid()), organization_id)
  );

CREATE POLICY "Internal team can insert own internal chat reads"
  ON public.internal_chat_message_reads FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND public.is_internal_user((select auth.uid()), organization_id)
    AND EXISTS (
      SELECT 1
      FROM public.internal_chat_messages message
      WHERE message.id = message_id
        AND message.organization_id = internal_chat_message_reads.organization_id
        AND message.user_id <> (select auth.uid())
        AND (
          message.chat_type = 'group'
          OR message.recipient_user_id = (select auth.uid())
        )
    )
  );

CREATE POLICY "Internal team can update own internal chat reads"
  ON public.internal_chat_message_reads FOR UPDATE TO authenticated
  USING (
    user_id = (select auth.uid())
    AND public.is_internal_user((select auth.uid()), organization_id)
  )
  WITH CHECK (
    user_id = (select auth.uid())
    AND public.is_internal_user((select auth.uid()), organization_id)
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'internal_chat_message_reads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_chat_message_reads;
  END IF;
END
$$;
