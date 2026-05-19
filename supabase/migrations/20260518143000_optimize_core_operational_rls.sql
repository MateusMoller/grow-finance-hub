-- Optimize core operational RLS policies and keep organization/client isolation.

DROP POLICY IF EXISTS "Tenant can view clients" ON public.clients;
DROP POLICY IF EXISTS "Tenant internal can insert clients" ON public.clients;
DROP POLICY IF EXISTS "Tenant internal can update clients" ON public.clients;
DROP POLICY IF EXISTS "Tenant managers can delete clients" ON public.clients;
CREATE POLICY "Tenant can view clients"
  ON public.clients FOR SELECT TO authenticated
  USING (
    public.is_internal_user((select auth.uid()), organization_id)
    OR public.can_access_client((select auth.uid()), id)
  );
CREATE POLICY "Tenant internal can insert clients"
  ON public.clients FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_user((select auth.uid()), organization_id));
CREATE POLICY "Tenant internal can update clients"
  ON public.clients FOR UPDATE TO authenticated
  USING (public.is_internal_user((select auth.uid()), organization_id))
  WITH CHECK (public.is_internal_user((select auth.uid()), organization_id));
CREATE POLICY "Tenant managers can delete clients"
  ON public.clients FOR DELETE TO authenticated
  USING (
    public.has_org_role((select auth.uid()), organization_id, 'admin')
    OR public.has_org_role((select auth.uid()), organization_id, 'director')
    OR public.has_org_role((select auth.uid()), organization_id, 'manager')
  );

DROP POLICY IF EXISTS "Tenant can view client requests by client link" ON public.client_requests;
DROP POLICY IF EXISTS "Tenant can insert client requests by client link" ON public.client_requests;
DROP POLICY IF EXISTS "Tenant can update client requests by client link" ON public.client_requests;
DROP POLICY IF EXISTS "Tenant can delete client requests by org" ON public.client_requests;
CREATE POLICY "Tenant can view client requests by client link"
  ON public.client_requests FOR SELECT TO authenticated
  USING (
    public.is_internal_user((select auth.uid()), organization_id)
    OR (client_id IS NOT NULL AND public.can_access_client((select auth.uid()), client_id))
    OR (client_id IS NULL AND user_id = (select auth.uid()))
  );
CREATE POLICY "Tenant can insert client requests by client link"
  ON public.client_requests FOR INSERT TO authenticated
  WITH CHECK (
    public.is_internal_user((select auth.uid()), organization_id)
    OR (
      user_id = (select auth.uid())
      AND (
        (client_id IS NOT NULL AND public.can_access_client((select auth.uid()), client_id))
        OR client_id IS NULL
      )
    )
  );
CREATE POLICY "Tenant can update client requests by client link"
  ON public.client_requests FOR UPDATE TO authenticated
  USING (
    public.is_internal_user((select auth.uid()), organization_id)
    OR (client_id IS NOT NULL AND public.can_access_client((select auth.uid()), client_id))
  )
  WITH CHECK (
    public.is_internal_user((select auth.uid()), organization_id)
    OR (client_id IS NOT NULL AND public.can_access_client((select auth.uid()), client_id))
  );
CREATE POLICY "Tenant can delete client requests by org"
  ON public.client_requests FOR DELETE TO authenticated
  USING (
    public.has_org_role((select auth.uid()), organization_id, 'admin')
    OR public.has_org_role((select auth.uid()), organization_id, 'director')
    OR public.has_org_role((select auth.uid()), organization_id, 'manager')
  );

DROP POLICY IF EXISTS "Tenant can view client documents by client link" ON public.client_documents;
DROP POLICY IF EXISTS "Tenant can insert client documents by client link" ON public.client_documents;
DROP POLICY IF EXISTS "Tenant internal can update client documents" ON public.client_documents;
DROP POLICY IF EXISTS "Tenant can delete client documents by client link" ON public.client_documents;
CREATE POLICY "Tenant can view client documents by client link"
  ON public.client_documents FOR SELECT TO authenticated
  USING (
    public.is_internal_user((select auth.uid()), organization_id)
    OR (client_id IS NOT NULL AND public.can_access_client((select auth.uid()), client_id))
    OR (client_id IS NULL AND user_id = (select auth.uid()))
  );
CREATE POLICY "Tenant can insert client documents by client link"
  ON public.client_documents FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND (
      (client_id IS NOT NULL AND public.can_access_client((select auth.uid()), client_id))
      OR client_id IS NULL
    )
  );
CREATE POLICY "Tenant internal can update client documents"
  ON public.client_documents FOR UPDATE TO authenticated
  USING (public.is_internal_user((select auth.uid()), organization_id))
  WITH CHECK (public.is_internal_user((select auth.uid()), organization_id));
CREATE POLICY "Tenant can delete client documents by client link"
  ON public.client_documents FOR DELETE TO authenticated
  USING (
    public.is_internal_user((select auth.uid()), organization_id)
    OR (
      processed_at IS NULL
      AND (
        (client_id IS NOT NULL AND public.can_access_client((select auth.uid()), client_id))
        OR (client_id IS NULL AND user_id = (select auth.uid()))
      )
    )
  );

DROP POLICY IF EXISTS "Clients and internal can view request messages" ON public.request_messages;
DROP POLICY IF EXISTS "Clients and internal can insert request messages" ON public.request_messages;
CREATE POLICY "Tenant can view request messages"
  ON public.request_messages FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid())
    OR public.is_internal_user((select auth.uid()), organization_id)
    OR EXISTS (
      SELECT 1 FROM public.client_requests cr
      WHERE cr.id = request_messages.request_id
        AND (
          cr.user_id = (select auth.uid())
          OR (cr.client_id IS NOT NULL AND public.can_access_client((select auth.uid()), cr.client_id))
        )
    )
  );
CREATE POLICY "Tenant can insert request messages"
  ON public.request_messages FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND (
      public.is_internal_user((select auth.uid()), organization_id)
      OR EXISTS (
        SELECT 1 FROM public.client_requests cr
        WHERE cr.id = request_messages.request_id
          AND (
            cr.user_id = (select auth.uid())
            OR (cr.client_id IS NOT NULL AND public.can_access_client((select auth.uid()), cr.client_id))
          )
      )
    )
  );

DROP POLICY IF EXISTS "Internal can view kanban tasks" ON public.kanban_tasks;
DROP POLICY IF EXISTS "Internal can insert kanban tasks" ON public.kanban_tasks;
DROP POLICY IF EXISTS "Internal can update kanban tasks" ON public.kanban_tasks;
DROP POLICY IF EXISTS "Managers can delete kanban tasks" ON public.kanban_tasks;
CREATE POLICY "Tenant internal can view kanban tasks"
  ON public.kanban_tasks FOR SELECT TO authenticated
  USING (public.is_internal_user((select auth.uid()), organization_id));
CREATE POLICY "Tenant internal can insert kanban tasks"
  ON public.kanban_tasks FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_user((select auth.uid()), organization_id));
CREATE POLICY "Tenant internal can update kanban tasks"
  ON public.kanban_tasks FOR UPDATE TO authenticated
  USING (public.is_internal_user((select auth.uid()), organization_id))
  WITH CHECK (public.is_internal_user((select auth.uid()), organization_id));
CREATE POLICY "Tenant managers can delete kanban tasks"
  ON public.kanban_tasks FOR DELETE TO authenticated
  USING (
    public.has_org_role((select auth.uid()), organization_id, 'admin')
    OR public.has_org_role((select auth.uid()), organization_id, 'director')
    OR public.has_org_role((select auth.uid()), organization_id, 'manager')
  );

DROP POLICY IF EXISTS "Internal can view calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS "Internal can insert calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS "Internal can update calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS "Managers can delete calendar events" ON public.calendar_events;
CREATE POLICY "Tenant internal can view calendar events"
  ON public.calendar_events FOR SELECT TO authenticated
  USING (public.is_internal_user((select auth.uid()), organization_id));
CREATE POLICY "Tenant internal can insert calendar events"
  ON public.calendar_events FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_user((select auth.uid()), organization_id));
CREATE POLICY "Tenant internal can update calendar events"
  ON public.calendar_events FOR UPDATE TO authenticated
  USING (public.is_internal_user((select auth.uid()), organization_id))
  WITH CHECK (public.is_internal_user((select auth.uid()), organization_id));
CREATE POLICY "Tenant managers can delete calendar events"
  ON public.calendar_events FOR DELETE TO authenticated
  USING (
    public.has_org_role((select auth.uid()), organization_id, 'admin')
    OR public.has_org_role((select auth.uid()), organization_id, 'director')
    OR public.has_org_role((select auth.uid()), organization_id, 'manager')
  );
