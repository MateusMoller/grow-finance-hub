-- Restrict user listing on internal "Usuarios" page to explicit internal roles only.
-- This prevents client/portal accounts (or accounts without role) from appearing.

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
    u.email::text AS email,
    p.display_name::text AS display_name,
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
    AND role_row.role IN (
      'admin'::public.app_role,
      'director'::public.app_role,
      'manager'::public.app_role,
      'employee'::public.app_role,
      'commercial'::public.app_role,
      'partner'::public.app_role,
      'departamento_pessoal'::public.app_role,
      'fiscal'::public.app_role,
      'contabil'::public.app_role
    )
  ORDER BY u.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_admin_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_admin_users() TO authenticated;
