-- Tenant-aware RLS policies for critical modules.
-- This migration intentionally runs after 20260515120000_add_tenant_ready_foundation.sql.

CREATE OR REPLACE FUNCTION public.can_access_client_open_finance(_client_id uuid)
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
      AND public.can_access_client(auth.uid(), c.id)
  );
$$;

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
      AND public.can_access_client(auth.uid(), c.id)
  );
$$;

DO $$
DECLARE
  policy_record record;
  critical_tables text[] := ARRAY[
    'clients',
    'client_data',
    'client_files',
    'client_requests',
    'request_messages',
    'client_documents',
    'client_portal_tasks',
    'kanban_tasks',
    'calendar_events',
    'obligation_templates',
    'client_obligation_profiles',
    'obligation_instances',
    'obligation_instance_events',
    'document_inbox_items',
    'obligation_instance_files',
    'expected_document_reference_files',
    'client_cashflow_accounts',
    'client_cashflow_entries',
    'client_cashflow_rules',
    'client_cashflow_consultive_alerts',
    'client_cashflow_health_snapshots',
    'open_finance_connections',
    'open_finance_accounts',
    'open_finance_transactions',
    'open_finance_webhook_events',
    'ai_interactions',
    'ai_action_logs',
    'ai_duplicate_checks',
    'whatsapp_webhook_logs',
    'integration_api_credentials'
  ];
BEGIN
  FOR policy_record IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (critical_tables)
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  END LOOP;
END
$$;

-- Clients
CREATE POLICY "Tenant internal can view clients and linked portal users can view own clients"
  ON public.clients
  FOR SELECT
  TO authenticated
  USING (
    public.is_internal_user(auth.uid(), organization_id)
    OR public.can_access_client(auth.uid(), id)
  );

CREATE POLICY "Tenant internal can insert clients"
  ON public.clients
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_internal_user(auth.uid(), organization_id));

CREATE POLICY "Tenant internal can update clients"
  ON public.clients
  FOR UPDATE
  TO authenticated
  USING (public.is_internal_user(auth.uid(), organization_id))
  WITH CHECK (public.is_internal_user(auth.uid(), organization_id));

CREATE POLICY "Tenant managers can delete clients"
  ON public.clients
  FOR DELETE
  TO authenticated
  USING (
    public.has_org_role(auth.uid(), organization_id, 'admin')
    OR public.has_org_role(auth.uid(), organization_id, 'director')
    OR public.has_org_role(auth.uid(), organization_id, 'manager')
  );

-- Client child tables with client_id
CREATE POLICY "Tenant can view client data"
  ON public.client_data
  FOR SELECT
  TO authenticated
  USING (public.can_access_client(auth.uid(), client_id));

CREATE POLICY "Tenant internal can manage client data"
  ON public.client_data
  FOR ALL
  TO authenticated
  USING (public.is_internal_user(auth.uid(), organization_id))
  WITH CHECK (public.is_internal_user(auth.uid(), organization_id));

CREATE POLICY "Tenant can view client files metadata"
  ON public.client_files
  FOR SELECT
  TO authenticated
  USING (public.can_access_client(auth.uid(), client_id));

CREATE POLICY "Tenant internal can manage client files metadata"
  ON public.client_files
  FOR ALL
  TO authenticated
  USING (public.is_internal_user(auth.uid(), organization_id))
  WITH CHECK (public.is_internal_user(auth.uid(), organization_id));

CREATE POLICY "Tenant can view portal tasks"
  ON public.client_portal_tasks
  FOR SELECT
  TO authenticated
  USING (public.can_access_client(auth.uid(), client_id));

CREATE POLICY "Tenant internal can insert portal tasks"
  ON public.client_portal_tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_internal_user(auth.uid(), organization_id));

CREATE POLICY "Tenant internal can update portal tasks"
  ON public.client_portal_tasks
  FOR UPDATE
  TO authenticated
  USING (public.is_internal_user(auth.uid(), organization_id))
  WITH CHECK (public.is_internal_user(auth.uid(), organization_id));

CREATE POLICY "Tenant internal can delete portal tasks"
  ON public.client_portal_tasks
  FOR DELETE
  TO authenticated
  USING (public.is_internal_user(auth.uid(), organization_id));

-- Legacy portal request/document tables are still user-owned, with organization scope for internal users.
CREATE POLICY "Tenant can view client requests"
  ON public.client_requests
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_internal_user(auth.uid(), organization_id)
  );

CREATE POLICY "Tenant clients and internal can insert client requests"
  ON public.client_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_internal_user(auth.uid(), organization_id)
  );

CREATE POLICY "Tenant internal can update client requests"
  ON public.client_requests
  FOR UPDATE
  TO authenticated
  USING (public.is_internal_user(auth.uid(), organization_id))
  WITH CHECK (public.is_internal_user(auth.uid(), organization_id));

CREATE POLICY "Tenant managers can delete client requests"
  ON public.client_requests
  FOR DELETE
  TO authenticated
  USING (
    public.has_org_role(auth.uid(), organization_id, 'admin')
    OR public.has_org_role(auth.uid(), organization_id, 'director')
    OR public.has_org_role(auth.uid(), organization_id, 'manager')
  );

CREATE POLICY "Tenant can view request messages"
  ON public.request_messages
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_internal_user(auth.uid(), organization_id)
    OR EXISTS (
      SELECT 1
      FROM public.client_requests cr
      WHERE cr.id = request_messages.request_id
        AND cr.user_id = auth.uid()
        AND cr.organization_id = request_messages.organization_id
    )
  );

CREATE POLICY "Tenant can insert request messages"
  ON public.request_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      public.is_internal_user(auth.uid(), organization_id)
      OR EXISTS (
        SELECT 1
        FROM public.client_requests cr
        WHERE cr.id = request_messages.request_id
          AND cr.user_id = auth.uid()
          AND cr.organization_id = request_messages.organization_id
      )
    )
  );

CREATE POLICY "Tenant can view client documents"
  ON public.client_documents
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_internal_user(auth.uid(), organization_id)
  );

CREATE POLICY "Tenant clients can insert own documents"
  ON public.client_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Tenant internal can update documents"
  ON public.client_documents
  FOR UPDATE
  TO authenticated
  USING (public.is_internal_user(auth.uid(), organization_id))
  WITH CHECK (public.is_internal_user(auth.uid(), organization_id));

CREATE POLICY "Tenant can delete client documents"
  ON public.client_documents
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_internal_user(auth.uid(), organization_id)
  );

-- Internal operational tables
DO $$
DECLARE
  table_name text;
  internal_tables text[] := ARRAY[
    'kanban_tasks',
    'calendar_events',
    'obligation_templates',
    'client_obligation_profiles',
    'obligation_instances',
    'obligation_instance_events',
    'document_inbox_items',
    'obligation_instance_files',
    'expected_document_reference_files',
    'client_cashflow_rules',
    'open_finance_webhook_events',
    'whatsapp_webhook_logs',
    'integration_api_credentials'
  ];
BEGIN
  FOREACH table_name IN ARRAY internal_tables LOOP
    EXECUTE format(
      'CREATE POLICY "Tenant internal can view %1$I" ON public.%1$I FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid(), organization_id))',
      table_name
    );

    EXECUTE format(
      'CREATE POLICY "Tenant internal can manage %1$I" ON public.%1$I FOR ALL TO authenticated USING (public.is_internal_user(auth.uid(), organization_id)) WITH CHECK (public.is_internal_user(auth.uid(), organization_id))',
      table_name
    );
  END LOOP;
END
$$;

-- Client financial and Open Finance tables
DO $$
DECLARE
  table_name text;
  client_finance_tables text[] := ARRAY[
    'client_cashflow_accounts',
    'client_cashflow_entries',
    'client_cashflow_consultive_alerts',
    'client_cashflow_health_snapshots',
    'open_finance_connections',
    'open_finance_accounts',
    'open_finance_transactions'
  ];
BEGIN
  FOREACH table_name IN ARRAY client_finance_tables LOOP
    EXECUTE format(
      'CREATE POLICY "Tenant can view %1$I" ON public.%1$I FOR SELECT TO authenticated USING (public.can_access_client(auth.uid(), client_id))',
      table_name
    );

    EXECUTE format(
      'CREATE POLICY "Tenant internal can manage %1$I" ON public.%1$I FOR ALL TO authenticated USING (public.is_internal_user(auth.uid(), organization_id)) WITH CHECK (public.is_internal_user(auth.uid(), organization_id))',
      table_name
    );
  END LOOP;
END
$$;

-- AI client-scoped tables use cliente_id.
CREATE POLICY "Tenant can view ai interactions"
  ON public.ai_interactions
  FOR SELECT
  TO authenticated
  USING (public.can_access_client(auth.uid(), cliente_id));

CREATE POLICY "Tenant internal can manage ai interactions"
  ON public.ai_interactions
  FOR ALL
  TO authenticated
  USING (public.is_internal_user(auth.uid(), organization_id))
  WITH CHECK (public.is_internal_user(auth.uid(), organization_id));

CREATE POLICY "Tenant can view ai action logs"
  ON public.ai_action_logs
  FOR SELECT
  TO authenticated
  USING (public.can_access_client(auth.uid(), cliente_id));

CREATE POLICY "Tenant internal can manage ai action logs"
  ON public.ai_action_logs
  FOR ALL
  TO authenticated
  USING (public.is_internal_user(auth.uid(), organization_id))
  WITH CHECK (public.is_internal_user(auth.uid(), organization_id));

CREATE POLICY "Tenant internal can view ai duplicate checks"
  ON public.ai_duplicate_checks
  FOR SELECT
  TO authenticated
  USING (public.is_internal_user(auth.uid(), organization_id));

CREATE POLICY "Tenant internal can manage ai duplicate checks"
  ON public.ai_duplicate_checks
  FOR ALL
  TO authenticated
  USING (public.is_internal_user(auth.uid(), organization_id))
  WITH CHECK (public.is_internal_user(auth.uid(), organization_id));
