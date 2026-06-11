-- Fix internal chat access after tenant scoping by making contacts and messages organization-aware.

CREATE OR REPLACE FUNCTION public.list_internal_user_profiles(_organization_id uuid)
RETURNS TABLE(user_id uuid, display_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.display_name
  FROM public.profiles p
  WHERE public.is_internal_user((select auth.uid()), _organization_id)
    AND public.is_internal_user(p.user_id, _organization_id)
  ORDER BY COALESCE(NULLIF(trim(p.display_name), ''), p.user_id::text);
$$;

REVOKE ALL ON FUNCTION public.list_internal_user_profiles(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_internal_user_profiles(uuid) TO authenticated;

DROP POLICY IF EXISTS "Internal team can view internal chat messages" ON public.internal_chat_messages;
DROP POLICY IF EXISTS "Internal team can insert own chat messages" ON public.internal_chat_messages;
DROP POLICY IF EXISTS "Internal team can update own chat messages" ON public.internal_chat_messages;
DROP POLICY IF EXISTS "Admins can delete internal chat messages" ON public.internal_chat_messages;

CREATE POLICY "Internal team can view internal chat messages"
  ON public.internal_chat_messages FOR SELECT TO authenticated
  USING (
    public.is_internal_user((select auth.uid()), organization_id)
    AND (
      chat_type = 'group'
      OR user_id = (select auth.uid())
      OR recipient_user_id = (select auth.uid())
    )
  );

CREATE POLICY "Internal team can insert own chat messages"
  ON public.internal_chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND public.is_internal_user((select auth.uid()), organization_id)
    AND (
      (chat_type = 'group' AND recipient_user_id IS NULL)
      OR (
        chat_type = 'direct'
        AND recipient_user_id IS NOT NULL
        AND recipient_user_id <> (select auth.uid())
        AND public.is_internal_user(recipient_user_id, organization_id)
      )
    )
  );

CREATE POLICY "Internal team can update own chat messages"
  ON public.internal_chat_messages FOR UPDATE TO authenticated
  USING (
    user_id = (select auth.uid())
    AND public.is_internal_user((select auth.uid()), organization_id)
  )
  WITH CHECK (
    user_id = (select auth.uid())
    AND public.is_internal_user((select auth.uid()), organization_id)
    AND (
      (chat_type = 'group' AND recipient_user_id IS NULL)
      OR (
        chat_type = 'direct'
        AND recipient_user_id IS NOT NULL
        AND recipient_user_id <> (select auth.uid())
        AND public.is_internal_user(recipient_user_id, organization_id)
      )
    )
  );

CREATE POLICY "Admins can delete internal chat messages"
  ON public.internal_chat_messages FOR DELETE TO authenticated
  USING (
    public.has_org_role((select auth.uid()), organization_id, 'admin')
    OR public.has_org_role((select auth.uid()), organization_id, 'manager')
  );
