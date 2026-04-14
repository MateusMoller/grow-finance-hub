-- Auto revoke portal and cashflow access whenever a client is marked as inactive.

WITH inactive_links AS (
  SELECT c.id, c.portal_user_id
  FROM public.clients c
  WHERE lower(trim(coalesce(c.status, ''))) = 'inativo'
    AND c.portal_user_id IS NOT NULL
)
DELETE FROM public.user_roles ur
USING inactive_links il
WHERE ur.user_id = il.portal_user_id
  AND ur.role = 'client'::public.app_role;

UPDATE public.clients c
SET
  portal_user_id = NULL,
  portal_cashflow_enabled = false,
  updated_at = now()
WHERE lower(trim(coalesce(c.status, ''))) = 'inativo'
  AND (c.portal_user_id IS NOT NULL OR c.portal_cashflow_enabled = true);

CREATE OR REPLACE FUNCTION public.revoke_inactive_client_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  linked_user_id uuid;
BEGIN
  IF lower(trim(coalesce(NEW.status, ''))) <> 'inativo' THEN
    RETURN NEW;
  END IF;

  linked_user_id := NEW.portal_user_id;
  IF linked_user_id IS NULL AND TG_OP = 'UPDATE' THEN
    linked_user_id := OLD.portal_user_id;
  END IF;

  NEW.portal_cashflow_enabled := false;
  NEW.portal_user_id := NULL;

  IF linked_user_id IS NOT NULL THEN
    DELETE FROM public.user_roles
    WHERE user_id = linked_user_id
      AND role = 'client'::public.app_role;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS revoke_inactive_client_access ON public.clients;

CREATE TRIGGER revoke_inactive_client_access
  BEFORE INSERT OR UPDATE OF status, portal_user_id, portal_cashflow_enabled
  ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.revoke_inactive_client_access();

CREATE OR REPLACE FUNCTION public.enforce_admin_cashflow_release()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.portal_cashflow_enabled IS DISTINCT FROM OLD.portal_cashflow_enabled
     AND COALESCE(auth.role(), '') = 'authenticated'
     AND NOT has_role(auth.uid(), 'admin')
     AND NOT (
       lower(trim(coalesce(NEW.status, ''))) = 'inativo'
       AND NEW.portal_cashflow_enabled = false
     ) THEN
    RAISE EXCEPTION 'Only admin can change cashflow portal access';
  END IF;

  RETURN NEW;
END;
$$;
