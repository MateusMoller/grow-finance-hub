CREATE OR REPLACE FUNCTION public.list_internal_user_profiles_by_org(organization_id uuid)
RETURNS TABLE(user_id uuid, display_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.display_name
  FROM public.profiles p
  WHERE
    organization_id IS NOT NULL
    AND public.is_internal_user((select auth.uid()), organization_id)
    AND public.is_internal_user(p.user_id, organization_id)
  ORDER BY COALESCE(NULLIF(trim(p.display_name), ''), p.user_id::text);
$$;

REVOKE ALL ON FUNCTION public.list_internal_user_profiles_by_org(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_internal_user_profiles_by_org(uuid) TO authenticated;
