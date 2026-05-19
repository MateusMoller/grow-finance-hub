-- Optimize remaining RLS advisor warnings without changing product behavior.

DROP POLICY IF EXISTS "Internal can view acessorias companies cache" ON public.acessorias_companies_cache;
DROP POLICY IF EXISTS "Internal can insert acessorias companies cache" ON public.acessorias_companies_cache;
DROP POLICY IF EXISTS "Internal can update acessorias companies cache" ON public.acessorias_companies_cache;
CREATE POLICY "Internal can view acessorias companies cache"
  ON public.acessorias_companies_cache FOR SELECT TO authenticated
  USING (public.is_internal_user((select auth.uid())));
CREATE POLICY "Internal can insert acessorias companies cache"
  ON public.acessorias_companies_cache FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_user((select auth.uid())));
CREATE POLICY "Internal can update acessorias companies cache"
  ON public.acessorias_companies_cache FOR UPDATE TO authenticated
  USING (public.is_internal_user((select auth.uid())))
  WITH CHECK (public.is_internal_user((select auth.uid())));

DROP POLICY IF EXISTS "Internal can view client acessorias links" ON public.client_acessorias_links;
DROP POLICY IF EXISTS "Internal can insert client acessorias links" ON public.client_acessorias_links;
DROP POLICY IF EXISTS "Internal can update client acessorias links" ON public.client_acessorias_links;
DROP POLICY IF EXISTS "Internal can delete client acessorias links" ON public.client_acessorias_links;
CREATE POLICY "Tenant internal can view client acessorias links"
  ON public.client_acessorias_links FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_acessorias_links.client_id
      AND public.is_internal_user((select auth.uid()), c.organization_id)
  ));
CREATE POLICY "Tenant internal can insert client acessorias links"
  ON public.client_acessorias_links FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_acessorias_links.client_id
      AND public.is_internal_user((select auth.uid()), c.organization_id)
  ));
CREATE POLICY "Tenant internal can update client acessorias links"
  ON public.client_acessorias_links FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_acessorias_links.client_id
      AND public.is_internal_user((select auth.uid()), c.organization_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_acessorias_links.client_id
      AND public.is_internal_user((select auth.uid()), c.organization_id)
  ));
CREATE POLICY "Tenant internal can delete client acessorias links"
  ON public.client_acessorias_links FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_acessorias_links.client_id
      AND public.is_internal_user((select auth.uid()), c.organization_id)
  ));

DROP POLICY IF EXISTS "Internal can view client acessorias obligations" ON public.client_acessorias_obligations;
DROP POLICY IF EXISTS "Internal can insert client acessorias obligations" ON public.client_acessorias_obligations;
DROP POLICY IF EXISTS "Internal can update client acessorias obligations" ON public.client_acessorias_obligations;
DROP POLICY IF EXISTS "Internal can delete client acessorias obligations" ON public.client_acessorias_obligations;
CREATE POLICY "Tenant internal can view client acessorias obligations"
  ON public.client_acessorias_obligations FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_acessorias_obligations.client_id
      AND public.is_internal_user((select auth.uid()), c.organization_id)
  ));
CREATE POLICY "Tenant internal can insert client acessorias obligations"
  ON public.client_acessorias_obligations FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_acessorias_obligations.client_id
      AND public.is_internal_user((select auth.uid()), c.organization_id)
  ));
CREATE POLICY "Tenant internal can update client acessorias obligations"
  ON public.client_acessorias_obligations FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_acessorias_obligations.client_id
      AND public.is_internal_user((select auth.uid()), c.organization_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_acessorias_obligations.client_id
      AND public.is_internal_user((select auth.uid()), c.organization_id)
  ));
CREATE POLICY "Tenant internal can delete client acessorias obligations"
  ON public.client_acessorias_obligations FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_acessorias_obligations.client_id
      AND public.is_internal_user((select auth.uid()), c.organization_id)
  ));

DROP POLICY IF EXISTS "Internal can view client acessorias uploads" ON public.client_acessorias_uploads;
DROP POLICY IF EXISTS "Internal can insert client acessorias uploads" ON public.client_acessorias_uploads;
DROP POLICY IF EXISTS "Internal can update client acessorias uploads" ON public.client_acessorias_uploads;
CREATE POLICY "Tenant internal can view client acessorias uploads"
  ON public.client_acessorias_uploads FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_acessorias_uploads.client_id
      AND public.is_internal_user((select auth.uid()), c.organization_id)
  ));
CREATE POLICY "Tenant internal can insert client acessorias uploads"
  ON public.client_acessorias_uploads FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_acessorias_uploads.client_id
      AND public.is_internal_user((select auth.uid()), c.organization_id)
  ));
CREATE POLICY "Tenant internal can update client acessorias uploads"
  ON public.client_acessorias_uploads FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_acessorias_uploads.client_id
      AND public.is_internal_user((select auth.uid()), c.organization_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_acessorias_uploads.client_id
      AND public.is_internal_user((select auth.uid()), c.organization_id)
  ));

DROP POLICY IF EXISTS "Clients can view published forms and internal can view all form" ON public.form_templates;
DROP POLICY IF EXISTS "Team can insert form templates" ON public.form_templates;
DROP POLICY IF EXISTS "Team can update form templates" ON public.form_templates;
DROP POLICY IF EXISTS "Admins can delete form templates" ON public.form_templates;
CREATE POLICY "Clients can view published forms and internal can view all form"
  ON public.form_templates FOR SELECT TO authenticated
  USING (is_published = true OR public.is_internal_user((select auth.uid())));
CREATE POLICY "Team can insert form templates"
  ON public.form_templates FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role((select auth.uid()), 'admin')
    OR public.has_role((select auth.uid()), 'director')
    OR public.has_role((select auth.uid()), 'manager')
    OR public.has_role((select auth.uid()), 'employee')
    OR public.has_role((select auth.uid()), 'commercial')
  );
CREATE POLICY "Team can update form templates"
  ON public.form_templates FOR UPDATE TO authenticated
  USING (
    public.has_role((select auth.uid()), 'admin')
    OR public.has_role((select auth.uid()), 'director')
    OR public.has_role((select auth.uid()), 'manager')
    OR public.has_role((select auth.uid()), 'employee')
    OR public.has_role((select auth.uid()), 'commercial')
  )
  WITH CHECK (
    public.has_role((select auth.uid()), 'admin')
    OR public.has_role((select auth.uid()), 'director')
    OR public.has_role((select auth.uid()), 'manager')
    OR public.has_role((select auth.uid()), 'employee')
    OR public.has_role((select auth.uid()), 'commercial')
  );
CREATE POLICY "Admins can delete form templates"
  ON public.form_templates FOR DELETE TO authenticated
  USING (
    public.has_role((select auth.uid()), 'admin')
    OR public.has_role((select auth.uid()), 'director')
    OR public.has_role((select auth.uid()), 'manager')
  );

DROP POLICY IF EXISTS "Users can view own manual progress" ON public.manual_user_progress;
DROP POLICY IF EXISTS "Users can insert own manual progress" ON public.manual_user_progress;
DROP POLICY IF EXISTS "Users can update own manual progress" ON public.manual_user_progress;
DROP POLICY IF EXISTS "Users can delete own manual progress" ON public.manual_user_progress;
CREATE POLICY "Users can view own manual progress" ON public.manual_user_progress FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can insert own manual progress" ON public.manual_user_progress FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can update own manual progress" ON public.manual_user_progress FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can delete own manual progress" ON public.manual_user_progress FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Admins can view newsletter subscribers" ON public.newsletter_subscribers;
DROP POLICY IF EXISTS "Admins can update newsletter subscribers" ON public.newsletter_subscribers;
DROP POLICY IF EXISTS "Admins can delete newsletter subscribers" ON public.newsletter_subscribers;
CREATE POLICY "Admins can view newsletter subscribers" ON public.newsletter_subscribers FOR SELECT TO authenticated USING (public.has_role((select auth.uid()), 'admin'));
CREATE POLICY "Admins can update newsletter subscribers" ON public.newsletter_subscribers FOR UPDATE TO authenticated USING (public.has_role((select auth.uid()), 'admin')) WITH CHECK (public.has_role((select auth.uid()), 'admin'));
CREATE POLICY "Admins can delete newsletter subscribers" ON public.newsletter_subscribers FOR DELETE TO authenticated USING (public.has_role((select auth.uid()), 'admin'));

DROP POLICY IF EXISTS "Clients and internal can view portal tasks" ON public.client_portal_tasks;
DROP POLICY IF EXISTS "Internal can insert portal tasks" ON public.client_portal_tasks;
DROP POLICY IF EXISTS "Internal team can update portal tasks" ON public.client_portal_tasks;
DROP POLICY IF EXISTS "Internal can delete portal tasks" ON public.client_portal_tasks;
CREATE POLICY "Tenant can view portal tasks"
  ON public.client_portal_tasks FOR SELECT TO authenticated
  USING (
    public.can_access_client((select auth.uid()), client_id)
    OR public.is_internal_user((select auth.uid()), organization_id)
  );
CREATE POLICY "Tenant internal can insert portal tasks"
  ON public.client_portal_tasks FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_user((select auth.uid()), organization_id));
CREATE POLICY "Tenant internal can update portal tasks"
  ON public.client_portal_tasks FOR UPDATE TO authenticated
  USING (public.is_internal_user((select auth.uid()), organization_id))
  WITH CHECK (public.is_internal_user((select auth.uid()), organization_id));
CREATE POLICY "Tenant internal can delete portal tasks"
  ON public.client_portal_tasks FOR DELETE TO authenticated
  USING (public.is_internal_user((select auth.uid()), organization_id));
