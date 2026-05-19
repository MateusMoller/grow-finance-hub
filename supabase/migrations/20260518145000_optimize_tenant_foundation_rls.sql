-- Optimize tenant foundation and CRM RLS policies.

DROP POLICY IF EXISTS "Tenant can view client links" ON public.client_users;
DROP POLICY IF EXISTS "Tenant internal can insert client links" ON public.client_users;
DROP POLICY IF EXISTS "Tenant internal can update client links" ON public.client_users;
DROP POLICY IF EXISTS "Tenant internal can delete client links" ON public.client_users;
CREATE POLICY "Tenant can view client links"
  ON public.client_users FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid())
    OR public.is_internal_user((select auth.uid()), organization_id)
  );
CREATE POLICY "Tenant internal can insert client links"
  ON public.client_users FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_user((select auth.uid()), organization_id));
CREATE POLICY "Tenant internal can update client links"
  ON public.client_users FOR UPDATE TO authenticated
  USING (public.is_internal_user((select auth.uid()), organization_id))
  WITH CHECK (public.is_internal_user((select auth.uid()), organization_id));
CREATE POLICY "Tenant internal can delete client links"
  ON public.client_users FOR DELETE TO authenticated
  USING (public.is_internal_user((select auth.uid()), organization_id));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.cnpj_lookup_cache'::regclass
      AND contype = 'p'
  ) THEN
    ALTER TABLE public.cnpj_lookup_cache
      ALTER COLUMN organization_id SET NOT NULL,
      ALTER COLUMN cnpj SET NOT NULL;

    ALTER TABLE public.cnpj_lookup_cache
      ADD CONSTRAINT cnpj_lookup_cache_pkey PRIMARY KEY (organization_id, cnpj);
  END IF;
END
$$;

DROP POLICY IF EXISTS "Tenant internal can manage org cnpj lookup cache" ON public.cnpj_lookup_cache;
CREATE POLICY "Tenant internal can manage org cnpj lookup cache"
  ON public.cnpj_lookup_cache FOR ALL TO authenticated
  USING (public.is_internal_user((select auth.uid()), organization_id))
  WITH CHECK (public.is_internal_user((select auth.uid()), organization_id));

DROP POLICY IF EXISTS "Tenant managers can manage integration credentials" ON public.integration_api_credentials;
CREATE POLICY "Tenant managers can manage integration credentials"
  ON public.integration_api_credentials FOR ALL TO authenticated
  USING (
    public.has_org_role((select auth.uid()), organization_id, 'admin')
    OR public.has_org_role((select auth.uid()), organization_id, 'director')
    OR public.has_org_role((select auth.uid()), organization_id, 'manager')
  )
  WITH CHECK (
    public.has_org_role((select auth.uid()), organization_id, 'admin')
    OR public.has_org_role((select auth.uid()), organization_id, 'director')
    OR public.has_org_role((select auth.uid()), organization_id, 'manager')
  );

DROP POLICY IF EXISTS "Tenant internal can manage crm leads" ON public.crm_leads;
CREATE POLICY "Tenant internal can manage crm leads"
  ON public.crm_leads FOR ALL TO authenticated
  USING (public.is_internal_user((select auth.uid()), organization_id))
  WITH CHECK (public.is_internal_user((select auth.uid()), organization_id));

DROP POLICY IF EXISTS "Tenant internal can manage crm goals" ON public.crm_goals;
CREATE POLICY "Tenant internal can manage crm goals"
  ON public.crm_goals FOR ALL TO authenticated
  USING (public.is_internal_user((select auth.uid()), organization_id))
  WITH CHECK (public.is_internal_user((select auth.uid()), organization_id));
