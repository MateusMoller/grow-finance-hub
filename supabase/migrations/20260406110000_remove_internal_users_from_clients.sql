-- Remove internal users that were mistakenly linked as clients
-- and prevent new links for internal roles.

WITH internal_users AS (
  SELECT DISTINCT ur.user_id
  FROM public.user_roles ur
  WHERE ur.role IN (
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
)
DELETE FROM public.clients c
USING internal_users iu
WHERE c.portal_user_id = iu.user_id;

WITH internal_users AS (
  SELECT DISTINCT ur.user_id
  FROM public.user_roles ur
  WHERE ur.role IN (
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
)
DELETE FROM public.user_roles ur
USING internal_users iu
WHERE ur.user_id = iu.user_id
  AND ur.role = 'client'::public.app_role;

CREATE OR REPLACE FUNCTION public.prevent_internal_user_client_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.portal_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = NEW.portal_user_id
      AND ur.role IN (
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
  ) THEN
    RAISE EXCEPTION 'Internal users cannot be linked as clients';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_internal_user_client_link ON public.clients;

CREATE TRIGGER prevent_internal_user_client_link
  BEFORE INSERT OR UPDATE OF portal_user_id ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_internal_user_client_link();
