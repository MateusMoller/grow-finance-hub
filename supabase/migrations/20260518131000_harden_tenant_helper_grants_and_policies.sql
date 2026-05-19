-- Harden tenant helper grants and add missing RLS policies for newly scoped tables.

CREATE OR REPLACE FUNCTION public.default_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT id FROM public.organizations WHERE slug = 'grow' LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.current_organization_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.default_organization_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_org_role(uuid, uuid, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_internal_user(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_internal_user(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_client(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sync_client_portal_user_link() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_client_document_client_id_from_request() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.default_organization_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_organization_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_internal_user(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_internal_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_client(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Internal can view org cnpj lookup cache" ON public.cnpj_lookup_cache;
CREATE POLICY "Internal can view org cnpj lookup cache"
  ON public.cnpj_lookup_cache
  FOR SELECT
  TO authenticated
  USING (public.is_internal_user(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Internal can manage org cnpj lookup cache" ON public.cnpj_lookup_cache;
CREATE POLICY "Internal can manage org cnpj lookup cache"
  ON public.cnpj_lookup_cache
  FOR ALL
  TO authenticated
  USING (public.is_internal_user(auth.uid(), organization_id))
  WITH CHECK (public.is_internal_user(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Org managers can view integration credentials" ON public.integration_api_credentials;
CREATE POLICY "Org managers can view integration credentials"
  ON public.integration_api_credentials
  FOR SELECT
  TO authenticated
  USING (
    public.has_org_role(auth.uid(), organization_id, 'admin')
    OR public.has_org_role(auth.uid(), organization_id, 'director')
    OR public.has_org_role(auth.uid(), organization_id, 'manager')
  );

DROP POLICY IF EXISTS "Org managers can manage integration credentials" ON public.integration_api_credentials;
CREATE POLICY "Org managers can manage integration credentials"
  ON public.integration_api_credentials
  FOR ALL
  TO authenticated
  USING (
    public.has_org_role(auth.uid(), organization_id, 'admin')
    OR public.has_org_role(auth.uid(), organization_id, 'director')
    OR public.has_org_role(auth.uid(), organization_id, 'manager')
  )
  WITH CHECK (
    public.has_org_role(auth.uid(), organization_id, 'admin')
    OR public.has_org_role(auth.uid(), organization_id, 'director')
    OR public.has_org_role(auth.uid(), organization_id, 'manager')
  );
