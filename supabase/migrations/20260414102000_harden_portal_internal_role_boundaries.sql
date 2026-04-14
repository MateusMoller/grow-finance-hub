-- Security hardening:
-- 1) Ensure internal users are not treated as portal clients.
-- 2) Require explicit client role for "own client profile" reads.
-- 3) Prevent mixed role assignments (internal + client) at write time.

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
UPDATE public.clients c
SET
  portal_user_id = NULL,
  updated_at = now()
FROM internal_users iu
WHERE c.portal_user_id = iu.user_id;

DROP POLICY IF EXISTS "Client can view own client profile" ON public.clients;

CREATE POLICY "Client can view own client profile"
  ON public.clients
  FOR SELECT
  TO authenticated
  USING (
    portal_user_id = auth.uid()
    AND has_role(auth.uid(), 'client'::public.app_role)
  );

CREATE OR REPLACE FUNCTION public.prevent_mixed_portal_internal_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'client'::public.app_role THEN
    IF EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = NEW.user_id
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
      RAISE EXCEPTION 'Internal users cannot receive client role';
    END IF;
  ELSIF NEW.role IN (
    'admin'::public.app_role,
    'director'::public.app_role,
    'manager'::public.app_role,
    'employee'::public.app_role,
    'commercial'::public.app_role,
    'partner'::public.app_role,
    'departamento_pessoal'::public.app_role,
    'fiscal'::public.app_role,
    'contabil'::public.app_role
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = NEW.user_id
        AND ur.role = 'client'::public.app_role
    ) THEN
      DELETE FROM public.user_roles
      WHERE user_id = NEW.user_id
        AND role = 'client'::public.app_role;

      UPDATE public.clients
      SET
        portal_user_id = NULL,
        updated_at = now()
      WHERE portal_user_id = NEW.user_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_mixed_portal_internal_roles ON public.user_roles;

CREATE TRIGGER prevent_mixed_portal_internal_roles
  BEFORE INSERT OR UPDATE OF role ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_mixed_portal_internal_roles();
