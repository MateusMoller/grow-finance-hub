-- Restrict internal Financeiro module data to admins while preserving client portal cashflow access.

CREATE OR REPLACE FUNCTION public.can_access_client_cashflow(_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = _client_id
      AND c.portal_cashflow_enabled = true
      AND (
        c.portal_user_id = (select auth.uid())
        OR EXISTS (
          SELECT 1
          FROM public.client_users cu
          WHERE cu.client_id = c.id
            AND cu.user_id = (select auth.uid())
            AND cu.organization_id = c.organization_id
            AND cu.status = 'active'
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_access_client_cashflow(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_client_cashflow(uuid) TO authenticated;

DROP POLICY IF EXISTS "Tenant can view cashflow accounts" ON public.client_cashflow_accounts;
DROP POLICY IF EXISTS "Tenant internal can insert cashflow accounts" ON public.client_cashflow_accounts;
DROP POLICY IF EXISTS "Tenant internal can update cashflow accounts" ON public.client_cashflow_accounts;
DROP POLICY IF EXISTS "Tenant internal can delete cashflow accounts" ON public.client_cashflow_accounts;

CREATE POLICY "Tenant can view cashflow accounts"
  ON public.client_cashflow_accounts FOR SELECT TO authenticated
  USING (
    public.has_org_role((select auth.uid()), organization_id, 'admin')
    OR public.can_access_client_cashflow(client_id)
  );

CREATE POLICY "Tenant admins can insert cashflow accounts"
  ON public.client_cashflow_accounts FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role((select auth.uid()), organization_id, 'admin'));

CREATE POLICY "Tenant admins can update cashflow accounts"
  ON public.client_cashflow_accounts FOR UPDATE TO authenticated
  USING (public.has_org_role((select auth.uid()), organization_id, 'admin'))
  WITH CHECK (public.has_org_role((select auth.uid()), organization_id, 'admin'));

CREATE POLICY "Tenant admins can delete cashflow accounts"
  ON public.client_cashflow_accounts FOR DELETE TO authenticated
  USING (public.has_org_role((select auth.uid()), organization_id, 'admin'));

DROP POLICY IF EXISTS "Tenant can view cashflow entries" ON public.client_cashflow_entries;
DROP POLICY IF EXISTS "Tenant can insert cashflow entries" ON public.client_cashflow_entries;
DROP POLICY IF EXISTS "Tenant can update cashflow entries" ON public.client_cashflow_entries;
DROP POLICY IF EXISTS "Tenant can delete cashflow entries" ON public.client_cashflow_entries;

CREATE POLICY "Tenant can view cashflow entries"
  ON public.client_cashflow_entries FOR SELECT TO authenticated
  USING (
    public.has_org_role((select auth.uid()), organization_id, 'admin')
    OR public.can_access_client_cashflow(client_id)
  );

CREATE POLICY "Tenant can insert cashflow entries"
  ON public.client_cashflow_entries FOR INSERT TO authenticated
  WITH CHECK (
    public.has_org_role((select auth.uid()), organization_id, 'admin')
    OR (created_by = (select auth.uid()) AND public.can_access_client_cashflow(client_id))
  );

CREATE POLICY "Tenant can update cashflow entries"
  ON public.client_cashflow_entries FOR UPDATE TO authenticated
  USING (
    public.has_org_role((select auth.uid()), organization_id, 'admin')
    OR (created_by = (select auth.uid()) AND public.can_access_client_cashflow(client_id))
  )
  WITH CHECK (
    public.has_org_role((select auth.uid()), organization_id, 'admin')
    OR (created_by = (select auth.uid()) AND public.can_access_client_cashflow(client_id))
  );

CREATE POLICY "Tenant can delete cashflow entries"
  ON public.client_cashflow_entries FOR DELETE TO authenticated
  USING (
    public.has_org_role((select auth.uid()), organization_id, 'admin')
    OR (created_by = (select auth.uid()) AND public.can_access_client_cashflow(client_id))
  );

DROP POLICY IF EXISTS "Tenant internal can manage cashflow rules" ON public.client_cashflow_rules;

CREATE POLICY "Tenant admins can manage cashflow rules"
  ON public.client_cashflow_rules FOR ALL TO authenticated
  USING (public.has_org_role((select auth.uid()), organization_id, 'admin'))
  WITH CHECK (public.has_org_role((select auth.uid()), organization_id, 'admin'));

DROP POLICY IF EXISTS "Tenant can view consultive cashflow alerts" ON public.client_cashflow_consultive_alerts;
DROP POLICY IF EXISTS "Tenant internal can manage consultive cashflow alerts" ON public.client_cashflow_consultive_alerts;
DROP POLICY IF EXISTS "Tenant internal can insert consultive cashflow alerts" ON public.client_cashflow_consultive_alerts;
DROP POLICY IF EXISTS "Tenant internal can update consultive cashflow alerts" ON public.client_cashflow_consultive_alerts;
DROP POLICY IF EXISTS "Tenant internal can delete consultive cashflow alerts" ON public.client_cashflow_consultive_alerts;

CREATE POLICY "Tenant can view consultive cashflow alerts"
  ON public.client_cashflow_consultive_alerts FOR SELECT TO authenticated
  USING (
    public.has_org_role((select auth.uid()), organization_id, 'admin')
    OR public.can_access_client_cashflow(client_id)
  );

CREATE POLICY "Tenant admins can insert consultive cashflow alerts"
  ON public.client_cashflow_consultive_alerts FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role((select auth.uid()), organization_id, 'admin'));

CREATE POLICY "Tenant admins can update consultive cashflow alerts"
  ON public.client_cashflow_consultive_alerts FOR UPDATE TO authenticated
  USING (public.has_org_role((select auth.uid()), organization_id, 'admin'))
  WITH CHECK (public.has_org_role((select auth.uid()), organization_id, 'admin'));

CREATE POLICY "Tenant admins can delete consultive cashflow alerts"
  ON public.client_cashflow_consultive_alerts FOR DELETE TO authenticated
  USING (public.has_org_role((select auth.uid()), organization_id, 'admin'));

DROP POLICY IF EXISTS "Tenant can view cashflow health snapshots" ON public.client_cashflow_health_snapshots;
DROP POLICY IF EXISTS "Tenant internal can manage cashflow health snapshots" ON public.client_cashflow_health_snapshots;
DROP POLICY IF EXISTS "Tenant internal can insert cashflow health snapshots" ON public.client_cashflow_health_snapshots;
DROP POLICY IF EXISTS "Tenant internal can update cashflow health snapshots" ON public.client_cashflow_health_snapshots;
DROP POLICY IF EXISTS "Tenant internal can delete cashflow health snapshots" ON public.client_cashflow_health_snapshots;

CREATE POLICY "Tenant can view cashflow health snapshots"
  ON public.client_cashflow_health_snapshots FOR SELECT TO authenticated
  USING (
    public.has_org_role((select auth.uid()), organization_id, 'admin')
    OR public.can_access_client_cashflow(client_id)
  );

CREATE POLICY "Tenant admins can insert cashflow health snapshots"
  ON public.client_cashflow_health_snapshots FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role((select auth.uid()), organization_id, 'admin'));

CREATE POLICY "Tenant admins can update cashflow health snapshots"
  ON public.client_cashflow_health_snapshots FOR UPDATE TO authenticated
  USING (public.has_org_role((select auth.uid()), organization_id, 'admin'))
  WITH CHECK (public.has_org_role((select auth.uid()), organization_id, 'admin'));

CREATE POLICY "Tenant admins can delete cashflow health snapshots"
  ON public.client_cashflow_health_snapshots FOR DELETE TO authenticated
  USING (public.has_org_role((select auth.uid()), organization_id, 'admin'));
