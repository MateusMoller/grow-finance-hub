-- Consolidate duplicate permissive policies on critical tenant tables and add
-- remaining indexes reported by Supabase advisors.

-- Clients
DROP POLICY IF EXISTS "Client can view own client profile" ON public.clients;
DROP POLICY IF EXISTS "Internal roles can view clients" ON public.clients;
DROP POLICY IF EXISTS "Admins can insert clients" ON public.clients;
DROP POLICY IF EXISTS "Team can update clients" ON public.clients;
DROP POLICY IF EXISTS "Admins can delete clients" ON public.clients;

CREATE POLICY "Tenant can view clients"
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

-- Portal requests
DROP POLICY IF EXISTS "Admins can delete requests" ON public.client_requests;
DROP POLICY IF EXISTS "Clients can insert own requests" ON public.client_requests;
DROP POLICY IF EXISTS "Internal can insert requests for linked portal clients" ON public.client_requests;
DROP POLICY IF EXISTS "Clients and internal can view requests" ON public.client_requests;
DROP POLICY IF EXISTS "Internal team can update requests" ON public.client_requests;
DROP POLICY IF EXISTS "Tenant managers can delete client requests" ON public.client_requests;

DROP POLICY IF EXISTS "Tenant can delete client requests by org" ON public.client_requests;
CREATE POLICY "Tenant can delete client requests by org"
  ON public.client_requests
  FOR DELETE
  TO authenticated
  USING (
    public.has_org_role(auth.uid(), organization_id, 'admin')
    OR public.has_org_role(auth.uid(), organization_id, 'director')
    OR public.has_org_role(auth.uid(), organization_id, 'manager')
  );

-- Portal documents
DROP POLICY IF EXISTS "Clients and internal can view documents" ON public.client_documents;
DROP POLICY IF EXISTS "Clients can delete unprocessed documents and internal can delet" ON public.client_documents;
DROP POLICY IF EXISTS "Clients can insert own documents" ON public.client_documents;
DROP POLICY IF EXISTS "Internal team can update document processing" ON public.client_documents;
DROP POLICY IF EXISTS "Tenant can delete client documents by client link" ON public.client_documents;

CREATE POLICY "Tenant internal can update client documents"
  ON public.client_documents
  FOR UPDATE
  TO authenticated
  USING (public.is_internal_user(auth.uid(), organization_id))
  WITH CHECK (public.is_internal_user(auth.uid(), organization_id));

CREATE POLICY "Tenant can delete client documents by client link"
  ON public.client_documents
  FOR DELETE
  TO authenticated
  USING (
    public.is_internal_user(auth.uid(), organization_id)
    OR (
      processed_at IS NULL
      AND (
        (client_id IS NOT NULL AND public.can_access_client(auth.uid(), client_id))
        OR (client_id IS NULL AND user_id = auth.uid())
      )
    )
  );

-- Client-user links
DROP POLICY IF EXISTS "Internal can manage client links" ON public.client_users;
DROP POLICY IF EXISTS "Users can view own client links" ON public.client_users;
DROP POLICY IF EXISTS "Clients and internal can view client users" ON public.client_users;
DROP POLICY IF EXISTS "Internal can manage client users" ON public.client_users;

CREATE POLICY "Tenant can view client links"
  ON public.client_users
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_internal_user(auth.uid(), organization_id)
  );

CREATE POLICY "Tenant internal can insert client links"
  ON public.client_users
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_internal_user(auth.uid(), organization_id));

CREATE POLICY "Tenant internal can update client links"
  ON public.client_users
  FOR UPDATE
  TO authenticated
  USING (public.is_internal_user(auth.uid(), organization_id))
  WITH CHECK (public.is_internal_user(auth.uid(), organization_id));

CREATE POLICY "Tenant internal can delete client links"
  ON public.client_users
  FOR DELETE
  TO authenticated
  USING (public.is_internal_user(auth.uid(), organization_id));

-- Sensitive configuration/cache tables
DROP POLICY IF EXISTS "Internal can view org cnpj lookup cache" ON public.cnpj_lookup_cache;
DROP POLICY IF EXISTS "Internal can manage org cnpj lookup cache" ON public.cnpj_lookup_cache;
CREATE POLICY "Tenant internal can manage org cnpj lookup cache"
  ON public.cnpj_lookup_cache
  FOR ALL
  TO authenticated
  USING (public.is_internal_user(auth.uid(), organization_id))
  WITH CHECK (public.is_internal_user(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Org managers can view integration credentials" ON public.integration_api_credentials;
DROP POLICY IF EXISTS "Org managers can manage integration credentials" ON public.integration_api_credentials;
CREATE POLICY "Tenant managers can manage integration credentials"
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

-- CRM
DROP POLICY IF EXISTS "Internal can view crm leads" ON public.crm_leads;
DROP POLICY IF EXISTS "Internal can manage crm leads" ON public.crm_leads;
CREATE POLICY "Tenant internal can manage crm leads"
  ON public.crm_leads
  FOR ALL
  TO authenticated
  USING (public.is_internal_user(auth.uid(), organization_id))
  WITH CHECK (public.is_internal_user(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Internal can view crm goals" ON public.crm_goals;
DROP POLICY IF EXISTS "Internal can manage crm goals" ON public.crm_goals;
CREATE POLICY "Tenant internal can manage crm goals"
  ON public.crm_goals
  FOR ALL
  TO authenticated
  USING (public.is_internal_user(auth.uid(), organization_id))
  WITH CHECK (public.is_internal_user(auth.uid(), organization_id));

-- Frequently joined foreign keys still reported by performance advisor.
DO $$
DECLARE
  item record;
  columns_ok boolean;
BEGIN
  FOR item IN
    SELECT *
    FROM (
      VALUES
        ('client_acessorias_obligations', 'cashflow_account_id', 'idx_client_acessorias_obligations_cashflow_account_id'),
        ('expected_document_reference_files', 'created_by', 'idx_expected_document_reference_files_created_by'),
        ('expected_document_reference_files', 'profile_id', 'idx_expected_document_reference_files_profile_id'),
        ('expected_document_reference_files', 'template_id', 'idx_expected_document_reference_files_template_id'),
        ('form_submissions', 'template_id', 'idx_form_submissions_template_id'),
        ('form_submissions', 'request_id', 'idx_form_submissions_request_id'),
        ('form_templates', 'created_by', 'idx_form_templates_created_by'),
        ('integration_api_credentials', 'created_by', 'idx_integration_api_credentials_created_by'),
        ('kanban_tasks', 'request_id', 'idx_kanban_tasks_request_id'),
        ('newsletters', 'created_by', 'idx_newsletters_created_by'),
        ('obligation_instances', 'completed_by_inbox_item_id', 'idx_obligation_instances_completed_by_inbox_item_id'),
        ('obligation_instances', 'profile_id', 'idx_obligation_instances_profile_id'),
        ('obligation_instances', 'template_id', 'idx_obligation_instances_template_id'),
        ('open_finance_connections', 'created_by', 'idx_open_finance_connections_created_by'),
        ('operational_audit_logs', 'actor_user_id', 'idx_operational_audit_logs_actor_user_id'),
        ('process_documents', 'created_by', 'idx_process_documents_created_by'),
        ('request_messages', 'request_id', 'idx_request_messages_request_id'),
        ('request_messages', 'user_id', 'idx_request_messages_user_id'),
        ('whatsapp_webhook_logs', 'cliente_id', 'idx_whatsapp_webhook_logs_cliente_id'),
        ('whatsapp_webhook_logs', 'user_id', 'idx_whatsapp_webhook_logs_user_id')
    ) AS v(table_name, column_name, index_name)
  LOOP
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = item.table_name
        AND c.column_name = item.column_name
    )
    INTO columns_ok;

    IF columns_ok THEN
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON public.%I (%I)',
        item.index_name,
        item.table_name,
        item.column_name
      );
    END IF;
  END LOOP;
END
$$;
