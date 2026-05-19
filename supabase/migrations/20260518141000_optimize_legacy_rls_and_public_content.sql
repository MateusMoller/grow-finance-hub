-- Optimize older RLS policies and keep tenant-aware checks on operational data.

DROP POLICY IF EXISTS "Role-based view client_data" ON public.client_data;
DROP POLICY IF EXISTS "Role-based insert client_data" ON public.client_data;
DROP POLICY IF EXISTS "Role-based update client_data" ON public.client_data;
DROP POLICY IF EXISTS "Role-based delete client_data" ON public.client_data;

CREATE POLICY "Tenant role-based view client_data"
  ON public.client_data FOR SELECT TO authenticated
  USING (
    public.has_org_role((select auth.uid()), organization_id, 'admin')
    OR public.has_org_role((select auth.uid()), organization_id, 'manager')
    OR public.has_org_role((select auth.uid()), organization_id, 'employee')
    OR public.has_org_role((select auth.uid()), organization_id, 'director')
    OR (public.has_org_role((select auth.uid()), organization_id, 'departamento_pessoal') AND (category = 'dp' OR category LIKE 'cadastro_%'))
    OR (public.has_org_role((select auth.uid()), organization_id, 'fiscal') AND (category = 'fiscal' OR category LIKE 'cadastro_%'))
    OR (public.has_org_role((select auth.uid()), organization_id, 'contabil') AND (category = 'contabilidade' OR category LIKE 'cadastro_%'))
  );

CREATE POLICY "Tenant role-based insert client_data"
  ON public.client_data FOR INSERT TO authenticated
  WITH CHECK (
    public.has_org_role((select auth.uid()), organization_id, 'admin')
    OR public.has_org_role((select auth.uid()), organization_id, 'manager')
    OR public.has_org_role((select auth.uid()), organization_id, 'employee')
    OR (public.has_org_role((select auth.uid()), organization_id, 'departamento_pessoal') AND (category = 'dp' OR category LIKE 'cadastro_%'))
    OR (public.has_org_role((select auth.uid()), organization_id, 'fiscal') AND (category = 'fiscal' OR category LIKE 'cadastro_%'))
    OR (public.has_org_role((select auth.uid()), organization_id, 'contabil') AND (category = 'contabilidade' OR category LIKE 'cadastro_%'))
  );

CREATE POLICY "Tenant role-based update client_data"
  ON public.client_data FOR UPDATE TO authenticated
  USING (
    public.has_org_role((select auth.uid()), organization_id, 'admin')
    OR public.has_org_role((select auth.uid()), organization_id, 'manager')
    OR public.has_org_role((select auth.uid()), organization_id, 'employee')
    OR (public.has_org_role((select auth.uid()), organization_id, 'departamento_pessoal') AND (category = 'dp' OR category LIKE 'cadastro_%'))
    OR (public.has_org_role((select auth.uid()), organization_id, 'fiscal') AND (category = 'fiscal' OR category LIKE 'cadastro_%'))
    OR (public.has_org_role((select auth.uid()), organization_id, 'contabil') AND (category = 'contabilidade' OR category LIKE 'cadastro_%'))
  )
  WITH CHECK (
    public.has_org_role((select auth.uid()), organization_id, 'admin')
    OR public.has_org_role((select auth.uid()), organization_id, 'manager')
    OR public.has_org_role((select auth.uid()), organization_id, 'employee')
    OR (public.has_org_role((select auth.uid()), organization_id, 'departamento_pessoal') AND (category = 'dp' OR category LIKE 'cadastro_%'))
    OR (public.has_org_role((select auth.uid()), organization_id, 'fiscal') AND (category = 'fiscal' OR category LIKE 'cadastro_%'))
    OR (public.has_org_role((select auth.uid()), organization_id, 'contabil') AND (category = 'contabilidade' OR category LIKE 'cadastro_%'))
  );

CREATE POLICY "Tenant role-based delete client_data"
  ON public.client_data FOR DELETE TO authenticated
  USING (
    public.has_org_role((select auth.uid()), organization_id, 'admin')
    OR public.has_org_role((select auth.uid()), organization_id, 'manager')
    OR public.has_org_role((select auth.uid()), organization_id, 'employee')
    OR (public.has_org_role((select auth.uid()), organization_id, 'departamento_pessoal') AND (category = 'dp' OR category LIKE 'cadastro_%'))
    OR (public.has_org_role((select auth.uid()), organization_id, 'fiscal') AND (category = 'fiscal' OR category LIKE 'cadastro_%'))
    OR (public.has_org_role((select auth.uid()), organization_id, 'contabil') AND (category = 'contabilidade' OR category LIKE 'cadastro_%'))
  );

DROP POLICY IF EXISTS "Role-based view client_files" ON public.client_files;
DROP POLICY IF EXISTS "Role-based insert client_files" ON public.client_files;
DROP POLICY IF EXISTS "Admins can delete client_files" ON public.client_files;

CREATE POLICY "Tenant role-based view client_files"
  ON public.client_files FOR SELECT TO authenticated
  USING (
    public.has_org_role((select auth.uid()), organization_id, 'admin')
    OR public.has_org_role((select auth.uid()), organization_id, 'manager')
    OR public.has_org_role((select auth.uid()), organization_id, 'employee')
    OR public.has_org_role((select auth.uid()), organization_id, 'director')
    OR (public.has_org_role((select auth.uid()), organization_id, 'departamento_pessoal') AND (category = 'dp' OR category LIKE 'cadastro_%'))
    OR (public.has_org_role((select auth.uid()), organization_id, 'fiscal') AND (category = 'fiscal' OR category LIKE 'cadastro_%'))
    OR (public.has_org_role((select auth.uid()), organization_id, 'contabil') AND (category = 'contabilidade' OR category LIKE 'cadastro_%'))
  );

CREATE POLICY "Tenant role-based insert client_files"
  ON public.client_files FOR INSERT TO authenticated
  WITH CHECK (
    public.has_org_role((select auth.uid()), organization_id, 'admin')
    OR public.has_org_role((select auth.uid()), organization_id, 'manager')
    OR public.has_org_role((select auth.uid()), organization_id, 'employee')
    OR (public.has_org_role((select auth.uid()), organization_id, 'departamento_pessoal') AND (category = 'dp' OR category LIKE 'cadastro_%'))
    OR (public.has_org_role((select auth.uid()), organization_id, 'fiscal') AND (category = 'fiscal' OR category LIKE 'cadastro_%'))
    OR (public.has_org_role((select auth.uid()), organization_id, 'contabil') AND (category = 'contabilidade' OR category LIKE 'cadastro_%'))
  );

CREATE POLICY "Tenant managers can delete client_files"
  ON public.client_files FOR DELETE TO authenticated
  USING (
    public.has_org_role((select auth.uid()), organization_id, 'admin')
    OR public.has_org_role((select auth.uid()), organization_id, 'manager')
  );

DROP POLICY IF EXISTS "Profiles: select own or admin" ON public.user_profiles;
DROP POLICY IF EXISTS "Profiles: insert own or admin" ON public.user_profiles;
DROP POLICY IF EXISTS "Profiles: update own or admin" ON public.user_profiles;
CREATE POLICY "Profiles: select own or admin" ON public.user_profiles FOR SELECT TO public USING ((select auth.uid()) = user_id OR public.is_grow_admin());
CREATE POLICY "Profiles: insert own or admin" ON public.user_profiles FOR INSERT TO public WITH CHECK ((select auth.uid()) = user_id OR public.is_grow_admin());
CREATE POLICY "Profiles: update own or admin" ON public.user_profiles FOR UPDATE TO public USING ((select auth.uid()) = user_id OR public.is_grow_admin()) WITH CHECK ((select auth.uid()) = user_id OR public.is_grow_admin());

DROP POLICY IF EXISTS "Access: select own or admin" ON public.user_access_control;
DROP POLICY IF EXISTS "Access: insert own pending or admin" ON public.user_access_control;
CREATE POLICY "Access: select own or admin" ON public.user_access_control FOR SELECT TO public USING ((select auth.uid()) = user_id OR public.is_grow_admin());
CREATE POLICY "Access: insert own pending or admin"
  ON public.user_access_control FOR INSERT TO public
  WITH CHECK (
    public.is_grow_admin()
    OR ((select auth.uid()) = user_id AND approved = false AND approved_by_email IS NULL AND approved_at IS NULL)
  );

DROP POLICY IF EXISTS "Users can view own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can insert own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can update own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can delete own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can view own push subscriptions"
  ON public.push_subscriptions FOR SELECT TO authenticated
  USING (
    (select auth.uid()) = user_id
    OR public.has_role((select auth.uid()), 'admin')
    OR public.has_role((select auth.uid()), 'director')
    OR public.has_role((select auth.uid()), 'manager')
  );
CREATE POLICY "Users can insert own push subscriptions" ON public.push_subscriptions FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can update own push subscriptions" ON public.push_subscriptions FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can delete own push subscriptions" ON public.push_subscriptions FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Internal can view all profiles and users can view own profile" ON public.profiles;
CREATE POLICY "Internal can view all profiles and users can view own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id OR public.is_internal_user((select auth.uid())));
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "Admins can delete profiles" ON public.profiles FOR DELETE TO authenticated USING (public.has_role((select auth.uid()), 'admin'));

DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = (select auth.uid()) OR public.has_org_role((select auth.uid()), organization_id, 'admin'));
CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_org_role((select auth.uid()), organization_id, 'admin'));
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_org_role((select auth.uid()), organization_id, 'admin'));

DROP POLICY IF EXISTS "kb_documents_write_service" ON public.kb_documents;
DROP POLICY IF EXISTS "kb_chunks_write_service" ON public.kb_chunks;
CREATE POLICY "kb_documents_insert_service" ON public.kb_documents FOR INSERT TO public WITH CHECK (((select auth.jwt()) ->> 'role') = 'service_role');
CREATE POLICY "kb_documents_update_service" ON public.kb_documents FOR UPDATE TO public USING (((select auth.jwt()) ->> 'role') = 'service_role') WITH CHECK (((select auth.jwt()) ->> 'role') = 'service_role');
CREATE POLICY "kb_documents_delete_service" ON public.kb_documents FOR DELETE TO public USING (((select auth.jwt()) ->> 'role') = 'service_role');
CREATE POLICY "kb_chunks_insert_service" ON public.kb_chunks FOR INSERT TO public WITH CHECK (((select auth.jwt()) ->> 'role') = 'service_role');
CREATE POLICY "kb_chunks_update_service" ON public.kb_chunks FOR UPDATE TO public USING (((select auth.jwt()) ->> 'role') = 'service_role') WITH CHECK (((select auth.jwt()) ->> 'role') = 'service_role');
CREATE POLICY "kb_chunks_delete_service" ON public.kb_chunks FOR DELETE TO public USING (((select auth.jwt()) ->> 'role') = 'service_role');

DROP POLICY IF EXISTS "Public can read published newsletters" ON public.newsletters;
DROP POLICY IF EXISTS "Team can read all newsletters" ON public.newsletters;
DROP POLICY IF EXISTS "Admins can insert newsletters" ON public.newsletters;
DROP POLICY IF EXISTS "Admins can update newsletters" ON public.newsletters;
DROP POLICY IF EXISTS "Admins can delete newsletters" ON public.newsletters;
CREATE POLICY "Public can read published newsletters" ON public.newsletters FOR SELECT TO anon USING (is_published = true);
CREATE POLICY "Team can read newsletters"
  ON public.newsletters FOR SELECT TO authenticated
  USING (
    is_published = true
    OR public.has_role((select auth.uid()), 'admin')
    OR public.has_role((select auth.uid()), 'director')
    OR public.has_role((select auth.uid()), 'manager')
    OR public.has_role((select auth.uid()), 'employee')
    OR public.has_role((select auth.uid()), 'commercial')
  );
CREATE POLICY "Admins can insert newsletters" ON public.newsletters FOR INSERT TO authenticated WITH CHECK (public.has_role((select auth.uid()), 'admin'));
CREATE POLICY "Admins can update newsletters" ON public.newsletters FOR UPDATE TO authenticated USING (public.has_role((select auth.uid()), 'admin')) WITH CHECK (public.has_role((select auth.uid()), 'admin'));
CREATE POLICY "Admins can delete newsletters" ON public.newsletters FOR DELETE TO authenticated USING (public.has_role((select auth.uid()), 'admin'));
