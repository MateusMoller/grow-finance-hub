-- Repair internal chat tenant schema. The tenant-aware RLS policies expect
-- internal_chat_messages.organization_id, but some environments missed the
-- column addition during the chat tenant migration.

ALTER TABLE public.internal_chat_messages
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

UPDATE public.internal_chat_messages AS message
SET organization_id = COALESCE(
  (
    SELECT access.organization_id
    FROM public.organization_user_access AS access
    WHERE access.user_id = message.user_id
      AND access.status = 'active'
      AND access.organization_id IS NOT NULL
    ORDER BY
      CASE access.primary_role
        WHEN 'admin' THEN 1
        WHEN 'collaborator' THEN 2
        WHEN 'client' THEN 3
        ELSE 4
      END,
      access.created_at ASC
    LIMIT 1
  ),
  (
    SELECT role.organization_id
    FROM public.user_roles AS role
    WHERE role.user_id = message.user_id
      AND role.organization_id IS NOT NULL
    ORDER BY role.created_at ASC
    LIMIT 1
  ),
  (
    SELECT organization.id
    FROM public.organizations AS organization
    WHERE organization.slug = 'grow'
    LIMIT 1
  ),
  (
    SELECT organization.id
    FROM public.organizations AS organization
    ORDER BY organization.created_at ASC
    LIMIT 1
  )
)
WHERE message.organization_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.internal_chat_messages
    WHERE organization_id IS NULL
  ) THEN
    ALTER TABLE public.internal_chat_messages
      ALTER COLUMN organization_id SET NOT NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS internal_chat_messages_organization_created_at_idx
  ON public.internal_chat_messages (organization_id, created_at ASC);

CREATE INDEX IF NOT EXISTS internal_chat_messages_organization_chat_type_created_at_idx
  ON public.internal_chat_messages (organization_id, chat_type, created_at ASC);

CREATE INDEX IF NOT EXISTS internal_chat_messages_organization_recipient_created_at_idx
  ON public.internal_chat_messages (organization_id, recipient_user_id, created_at ASC);

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
