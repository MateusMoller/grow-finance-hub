ALTER TABLE public.internal_chat_messages
  ADD COLUMN IF NOT EXISTS chat_type text NOT NULL DEFAULT 'group',
  ADD COLUMN IF NOT EXISTS recipient_user_id uuid NULL REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.internal_chat_messages
  DROP CONSTRAINT IF EXISTS internal_chat_messages_chat_type_check;

ALTER TABLE public.internal_chat_messages
  ADD CONSTRAINT internal_chat_messages_chat_type_check
  CHECK (chat_type IN ('group', 'direct'));

ALTER TABLE public.internal_chat_messages
  DROP CONSTRAINT IF EXISTS internal_chat_messages_direct_recipient_check;

ALTER TABLE public.internal_chat_messages
  ADD CONSTRAINT internal_chat_messages_direct_recipient_check
  CHECK (
    (chat_type = 'group' AND recipient_user_id IS NULL)
    OR
    (chat_type = 'direct' AND recipient_user_id IS NOT NULL AND recipient_user_id <> user_id)
  );

UPDATE public.internal_chat_messages
SET chat_type = 'group', recipient_user_id = NULL
WHERE chat_type IS DISTINCT FROM 'group'
   OR recipient_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS internal_chat_messages_chat_type_created_at_idx
  ON public.internal_chat_messages (chat_type, created_at ASC);

CREATE INDEX IF NOT EXISTS internal_chat_messages_recipient_created_at_idx
  ON public.internal_chat_messages (recipient_user_id, created_at ASC);

DROP POLICY IF EXISTS "Internal team can view internal chat messages" ON public.internal_chat_messages;
CREATE POLICY "Internal team can view internal chat messages"
ON public.internal_chat_messages
FOR SELECT
TO authenticated
USING (
  (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'director')
    OR has_role(auth.uid(), 'manager')
    OR has_role(auth.uid(), 'employee')
    OR has_role(auth.uid(), 'commercial')
    OR has_role(auth.uid(), 'departamento_pessoal')
    OR has_role(auth.uid(), 'fiscal')
    OR has_role(auth.uid(), 'contabil')
  )
  AND
  (
    chat_type = 'group'
    OR user_id = auth.uid()
    OR recipient_user_id = auth.uid()
  )
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
  AND (
    (chat_type = 'group' AND recipient_user_id IS NULL)
    OR (
      chat_type = 'direct'
      AND recipient_user_id IS NOT NULL
      AND recipient_user_id <> auth.uid()
      AND (
        has_role(recipient_user_id, 'admin')
        OR has_role(recipient_user_id, 'director')
        OR has_role(recipient_user_id, 'manager')
        OR has_role(recipient_user_id, 'employee')
        OR has_role(recipient_user_id, 'commercial')
        OR has_role(recipient_user_id, 'departamento_pessoal')
        OR has_role(recipient_user_id, 'fiscal')
        OR has_role(recipient_user_id, 'contabil')
      )
    )
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
  AND (
    (chat_type = 'group' AND recipient_user_id IS NULL)
    OR (
      chat_type = 'direct'
      AND recipient_user_id IS NOT NULL
      AND recipient_user_id <> auth.uid()
      AND (
        has_role(recipient_user_id, 'admin')
        OR has_role(recipient_user_id, 'director')
        OR has_role(recipient_user_id, 'manager')
        OR has_role(recipient_user_id, 'employee')
        OR has_role(recipient_user_id, 'commercial')
        OR has_role(recipient_user_id, 'departamento_pessoal')
        OR has_role(recipient_user_id, 'fiscal')
        OR has_role(recipient_user_id, 'contabil')
      )
    )
  )
);

CREATE OR REPLACE FUNCTION public.list_internal_user_profiles()
RETURNS TABLE(user_id uuid, display_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.display_name
  FROM public.profiles p
  WHERE
    has_role(p.user_id, 'admin')
    OR has_role(p.user_id, 'director')
    OR has_role(p.user_id, 'manager')
    OR has_role(p.user_id, 'employee')
    OR has_role(p.user_id, 'commercial')
    OR has_role(p.user_id, 'departamento_pessoal')
    OR has_role(p.user_id, 'fiscal')
    OR has_role(p.user_id, 'contabil')
  ORDER BY COALESCE(NULLIF(trim(p.display_name), ''), p.user_id::text);
$$;

REVOKE ALL ON FUNCTION public.list_internal_user_profiles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_internal_user_profiles() TO authenticated;
