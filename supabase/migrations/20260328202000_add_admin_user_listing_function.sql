CREATE OR REPLACE FUNCTION public.list_admin_users()
RETURNS TABLE(
  user_id uuid,
  email text,
  display_name text,
  role app_role,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can list users';
  END IF;

  RETURN QUERY
  SELECT
    u.id AS user_id,
    u.email,
    p.display_name,
    role_row.role,
    u.created_at
  FROM auth.users u
  LEFT JOIN public.profiles p
    ON p.user_id = u.id
  LEFT JOIN LATERAL (
    SELECT ur.role
    FROM public.user_roles ur
    WHERE ur.user_id = u.id
    ORDER BY ur.created_at DESC
    LIMIT 1
  ) AS role_row ON true
  WHERE u.deleted_at IS NULL
    AND (role_row.role IS NULL OR role_row.role <> 'client')
  ORDER BY u.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_admin_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_admin_users() TO authenticated;
