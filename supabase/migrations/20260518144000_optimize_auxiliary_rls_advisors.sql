-- Optimize auxiliary RLS policies surfaced by Supabase advisors.

DROP POLICY IF EXISTS "Users can view own manual state" ON public.manual_user_state;
DROP POLICY IF EXISTS "Users can insert own manual state" ON public.manual_user_state;
DROP POLICY IF EXISTS "Users can update own manual state" ON public.manual_user_state;
DROP POLICY IF EXISTS "Users can delete own manual state" ON public.manual_user_state;
CREATE POLICY "Users can view own manual state" ON public.manual_user_state FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can insert own manual state" ON public.manual_user_state FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can update own manual state" ON public.manual_user_state FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can delete own manual state" ON public.manual_user_state FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Clients and internal can view form submissions" ON public.form_submissions;
DROP POLICY IF EXISTS "Authenticated can insert own form submissions" ON public.form_submissions;
DROP POLICY IF EXISTS "Internal team can update form submissions" ON public.form_submissions;
DROP POLICY IF EXISTS "Managers can delete form submissions" ON public.form_submissions;
CREATE POLICY "Tenant can view form submissions"
  ON public.form_submissions FOR SELECT TO authenticated
  USING (
    submitted_by = (select auth.uid())
    OR public.is_internal_user((select auth.uid()), organization_id)
    OR (client_id IS NOT NULL AND public.can_access_client((select auth.uid()), client_id))
  );
CREATE POLICY "Tenant can insert own form submissions"
  ON public.form_submissions FOR INSERT TO authenticated
  WITH CHECK (
    submitted_by = (select auth.uid())
    AND (
      client_id IS NULL
      OR public.can_access_client((select auth.uid()), client_id)
      OR public.is_internal_user((select auth.uid()), organization_id)
    )
  );
CREATE POLICY "Tenant internal can update form submissions"
  ON public.form_submissions FOR UPDATE TO authenticated
  USING (public.is_internal_user((select auth.uid()), organization_id))
  WITH CHECK (public.is_internal_user((select auth.uid()), organization_id));
CREATE POLICY "Tenant managers can delete form submissions"
  ON public.form_submissions FOR DELETE TO authenticated
  USING (
    public.has_org_role((select auth.uid()), organization_id, 'admin')
    OR public.has_org_role((select auth.uid()), organization_id, 'director')
    OR public.has_org_role((select auth.uid()), organization_id, 'manager')
  );

DROP POLICY IF EXISTS "Team can view site leads" ON public.site_leads;
DROP POLICY IF EXISTS "Team can delete site leads" ON public.site_leads;
CREATE POLICY "Tenant team can view site leads"
  ON public.site_leads FOR SELECT TO authenticated
  USING (
    public.has_org_role((select auth.uid()), organization_id, 'admin')
    OR public.has_org_role((select auth.uid()), organization_id, 'director')
    OR public.has_org_role((select auth.uid()), organization_id, 'manager')
    OR public.has_org_role((select auth.uid()), organization_id, 'employee')
    OR public.has_org_role((select auth.uid()), organization_id, 'commercial')
  );
CREATE POLICY "Tenant team can delete site leads"
  ON public.site_leads FOR DELETE TO authenticated
  USING (
    public.has_org_role((select auth.uid()), organization_id, 'admin')
    OR public.has_org_role((select auth.uid()), organization_id, 'director')
    OR public.has_org_role((select auth.uid()), organization_id, 'manager')
    OR public.has_org_role((select auth.uid()), organization_id, 'employee')
    OR public.has_org_role((select auth.uid()), organization_id, 'commercial')
  );

DROP POLICY IF EXISTS "Team can read own inbox messages" ON public.email_inbox_messages;
DROP POLICY IF EXISTS "Team can update own inbox messages" ON public.email_inbox_messages;
CREATE POLICY "Team can read own inbox messages"
  ON public.email_inbox_messages FOR SELECT TO authenticated
  USING (
    public.has_role((select auth.uid()), 'admin')
    OR lower(COALESCE(((select auth.jwt()) ->> 'email'), '')) = to_email
    OR EXISTS (
      SELECT 1 FROM public.user_settings us
      WHERE us.user_id = (select auth.uid())
        AND us.company_email IS NOT NULL
        AND lower(us.company_email) = email_inbox_messages.to_email
    )
  );
CREATE POLICY "Team can update own inbox messages"
  ON public.email_inbox_messages FOR UPDATE TO authenticated
  USING (
    public.has_role((select auth.uid()), 'admin')
    OR lower(COALESCE(((select auth.jwt()) ->> 'email'), '')) = to_email
    OR EXISTS (
      SELECT 1 FROM public.user_settings us
      WHERE us.user_id = (select auth.uid())
        AND us.company_email IS NOT NULL
        AND lower(us.company_email) = email_inbox_messages.to_email
    )
  )
  WITH CHECK (
    public.has_role((select auth.uid()), 'admin')
    OR lower(COALESCE(((select auth.jwt()) ->> 'email'), '')) = to_email
    OR EXISTS (
      SELECT 1 FROM public.user_settings us
      WHERE us.user_id = (select auth.uid())
        AND us.company_email IS NOT NULL
        AND lower(us.company_email) = email_inbox_messages.to_email
    )
  );

DROP POLICY IF EXISTS "Internal team can view internal chat messages" ON public.internal_chat_messages;
DROP POLICY IF EXISTS "Internal team can insert own chat messages" ON public.internal_chat_messages;
DROP POLICY IF EXISTS "Internal team can update own chat messages" ON public.internal_chat_messages;
DROP POLICY IF EXISTS "Admins can delete internal chat messages" ON public.internal_chat_messages;
CREATE POLICY "Internal team can view internal chat messages"
  ON public.internal_chat_messages FOR SELECT TO authenticated
  USING (
    public.is_internal_user((select auth.uid()))
    AND (chat_type = 'group' OR user_id = (select auth.uid()) OR recipient_user_id = (select auth.uid()))
  );
CREATE POLICY "Internal team can insert own chat messages"
  ON public.internal_chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND public.is_internal_user((select auth.uid()))
    AND (
      (chat_type = 'group' AND recipient_user_id IS NULL)
      OR (
        chat_type = 'direct'
        AND recipient_user_id IS NOT NULL
        AND recipient_user_id <> (select auth.uid())
        AND public.is_internal_user(recipient_user_id)
      )
    )
  );
CREATE POLICY "Internal team can update own chat messages"
  ON public.internal_chat_messages FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()) AND public.is_internal_user((select auth.uid())))
  WITH CHECK (
    user_id = (select auth.uid())
    AND public.is_internal_user((select auth.uid()))
    AND (
      (chat_type = 'group' AND recipient_user_id IS NULL)
      OR (
        chat_type = 'direct'
        AND recipient_user_id IS NOT NULL
        AND recipient_user_id <> (select auth.uid())
        AND public.is_internal_user(recipient_user_id)
      )
    )
  );
CREATE POLICY "Admins can delete internal chat messages"
  ON public.internal_chat_messages FOR DELETE TO authenticated
  USING (
    public.has_role((select auth.uid()), 'admin')
    OR public.has_role((select auth.uid()), 'manager')
  );

DROP POLICY IF EXISTS "Internal can view organizations" ON public.organizations;
CREATE POLICY "Internal can view organizations"
  ON public.organizations FOR SELECT TO authenticated
  USING (
    public.is_internal_user((select auth.uid()), id)
    OR EXISTS (
      SELECT 1 FROM public.client_users cu
      WHERE cu.organization_id = organizations.id
        AND cu.user_id = (select auth.uid())
        AND cu.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Internal can view organization settings" ON public.organization_settings;
CREATE POLICY "Internal can view organization settings"
  ON public.organization_settings FOR SELECT TO authenticated
  USING (
    public.is_internal_user((select auth.uid()), organization_id)
    OR EXISTS (
      SELECT 1 FROM public.client_users cu
      WHERE cu.organization_id = organization_settings.organization_id
        AND cu.user_id = (select auth.uid())
        AND cu.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Internal can view audit logs" ON public.operational_audit_logs;
DROP POLICY IF EXISTS "Authenticated can insert audit logs" ON public.operational_audit_logs;
CREATE POLICY "Internal can view audit logs"
  ON public.operational_audit_logs FOR SELECT TO authenticated
  USING (public.is_internal_user((select auth.uid()), organization_id));
CREATE POLICY "Authenticated can insert audit logs"
  ON public.operational_audit_logs FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Internal can view crm lead events" ON public.crm_lead_events;
DROP POLICY IF EXISTS "Internal can insert crm lead events" ON public.crm_lead_events;
CREATE POLICY "Internal can view crm lead events"
  ON public.crm_lead_events FOR SELECT TO authenticated
  USING (public.is_internal_user((select auth.uid()), organization_id));
CREATE POLICY "Internal can insert crm lead events"
  ON public.crm_lead_events FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_user((select auth.uid()), organization_id));
