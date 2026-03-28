CREATE TABLE IF NOT EXISTS public.internal_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT internal_chat_messages_content_length CHECK (char_length(trim(content)) > 0 AND char_length(content) <= 4000)
);

CREATE INDEX IF NOT EXISTS internal_chat_messages_created_at_idx
  ON public.internal_chat_messages (created_at ASC);

CREATE INDEX IF NOT EXISTS internal_chat_messages_user_id_idx
  ON public.internal_chat_messages (user_id);

DROP TRIGGER IF EXISTS update_internal_chat_messages_updated_at ON public.internal_chat_messages;
CREATE TRIGGER update_internal_chat_messages_updated_at
  BEFORE UPDATE ON public.internal_chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.internal_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal team can view internal chat messages" ON public.internal_chat_messages;
CREATE POLICY "Internal team can view internal chat messages"
ON public.internal_chat_messages
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'director')
  OR has_role(auth.uid(), 'manager')
  OR has_role(auth.uid(), 'employee')
  OR has_role(auth.uid(), 'commercial')
  OR has_role(auth.uid(), 'departamento_pessoal')
  OR has_role(auth.uid(), 'fiscal')
  OR has_role(auth.uid(), 'contabil')
);

DROP POLICY IF EXISTS "Internal team can insert own chat messages" ON public.internal_chat_messages;
CREATE POLICY "Internal team can insert own chat messages"
ON public.internal_chat_messages
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'director')
    OR has_role(auth.uid(), 'manager')
    OR has_role(auth.uid(), 'employee')
    OR has_role(auth.uid(), 'commercial')
    OR has_role(auth.uid(), 'departamento_pessoal')
    OR has_role(auth.uid(), 'fiscal')
    OR has_role(auth.uid(), 'contabil')
  )
);

DROP POLICY IF EXISTS "Internal team can update own chat messages" ON public.internal_chat_messages;
CREATE POLICY "Internal team can update own chat messages"
ON public.internal_chat_messages
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  AND (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'director')
    OR has_role(auth.uid(), 'manager')
    OR has_role(auth.uid(), 'employee')
    OR has_role(auth.uid(), 'commercial')
    OR has_role(auth.uid(), 'departamento_pessoal')
    OR has_role(auth.uid(), 'fiscal')
    OR has_role(auth.uid(), 'contabil')
  )
)
WITH CHECK (
  user_id = auth.uid()
  AND (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'director')
    OR has_role(auth.uid(), 'manager')
    OR has_role(auth.uid(), 'employee')
    OR has_role(auth.uid(), 'commercial')
    OR has_role(auth.uid(), 'departamento_pessoal')
    OR has_role(auth.uid(), 'fiscal')
    OR has_role(auth.uid(), 'contabil')
  )
);

DROP POLICY IF EXISTS "Admins can delete internal chat messages" ON public.internal_chat_messages;
CREATE POLICY "Admins can delete internal chat messages"
ON public.internal_chat_messages
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'manager')
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'internal_chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_chat_messages;
  END IF;
END
$$;
