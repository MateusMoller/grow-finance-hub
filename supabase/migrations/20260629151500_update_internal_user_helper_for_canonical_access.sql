CREATE OR REPLACE FUNCTION public.is_internal_user(_user_id uuid, _organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.organization_user_access access
      WHERE access.user_id = _user_id
        AND access.organization_id = _organization_id
        AND access.primary_role IN ('admin', 'colaborador')
        AND access.status = 'active'
        AND NOT access.requires_access_review
    )
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = _user_id
        AND ur.organization_id = _organization_id
        AND ur.role IN (
          'admin',
          'director',
          'manager',
          'employee',
          'commercial',
          'partner',
          'departamento_pessoal',
          'fiscal',
          'contabil'
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.is_internal_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_internal_user(_user_id, public.current_organization_id());
$$;
