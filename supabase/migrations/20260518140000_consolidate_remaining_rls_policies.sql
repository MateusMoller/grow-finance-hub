-- Consolidate remaining high-volume RLS policies and avoid per-row auth.uid()
-- evaluation on user-owned legacy tables.

ALTER TABLE public.document_ingestion_jobs
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

UPDATE public.document_ingestion_jobs dij
SET organization_id = COALESCE(
  c.organization_id,
  dc.organization_id,
  oi.organization_id,
  dii.organization_id,
  public.default_organization_id()
)
FROM public.document_ingestion_jobs source
LEFT JOIN public.clients c ON c.id = source.client_id
LEFT JOIN public.clients dc ON dc.id = source.detected_client_id
LEFT JOIN public.obligation_instances oi ON oi.id = source.instance_id
LEFT JOIN public.document_inbox_items dii ON dii.id = source.inbox_item_id
WHERE dij.id = source.id
  AND dij.organization_id IS NULL;

ALTER TABLE public.document_ingestion_jobs
  ALTER COLUMN organization_id SET DEFAULT public.default_organization_id();

CREATE INDEX IF NOT EXISTS idx_document_ingestion_jobs_organization_id
  ON public.document_ingestion_jobs(organization_id);

-- AI and WhatsApp
DROP POLICY IF EXISTS "Client can view own ai interactions" ON public.ai_interactions;
DROP POLICY IF EXISTS "Internal can view ai interactions" ON public.ai_interactions;
CREATE POLICY "Tenant can view ai interactions"
  ON public.ai_interactions
  FOR SELECT
  TO authenticated
  USING (
    public.is_internal_user((select auth.uid()), organization_id)
    OR public.can_access_client((select auth.uid()), cliente_id)
  );

DROP POLICY IF EXISTS "Client can view own ai action logs" ON public.ai_action_logs;
DROP POLICY IF EXISTS "Internal can view ai action logs" ON public.ai_action_logs;
CREATE POLICY "Tenant can view ai action logs"
  ON public.ai_action_logs
  FOR SELECT
  TO authenticated
  USING (
    public.is_internal_user((select auth.uid()), organization_id)
    OR public.can_access_client((select auth.uid()), cliente_id)
  );

DROP POLICY IF EXISTS "Internal can view ai duplicate checks" ON public.ai_duplicate_checks;
CREATE POLICY "Tenant internal can view ai duplicate checks"
  ON public.ai_duplicate_checks
  FOR SELECT
  TO authenticated
  USING (public.is_internal_user((select auth.uid()), organization_id));

DROP POLICY IF EXISTS "Internal can view whatsapp webhook logs" ON public.whatsapp_webhook_logs;
CREATE POLICY "Tenant internal can view whatsapp webhook logs"
  ON public.whatsapp_webhook_logs
  FOR SELECT
  TO authenticated
  USING (public.is_internal_user((select auth.uid()), organization_id));

-- Cashflow and Open Finance
DROP POLICY IF EXISTS "Internal can manage cashflow accounts" ON public.client_cashflow_accounts;
DROP POLICY IF EXISTS "Client and internal can view cashflow accounts" ON public.client_cashflow_accounts;
CREATE POLICY "Tenant can view cashflow accounts"
  ON public.client_cashflow_accounts
  FOR SELECT
  TO authenticated
  USING (
    public.is_internal_user((select auth.uid()), organization_id)
    OR public.can_access_client_cashflow(client_id)
  );
CREATE POLICY "Tenant internal can insert cashflow accounts"
  ON public.client_cashflow_accounts FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_user((select auth.uid()), organization_id));
CREATE POLICY "Tenant internal can update cashflow accounts"
  ON public.client_cashflow_accounts FOR UPDATE TO authenticated
  USING (public.is_internal_user((select auth.uid()), organization_id))
  WITH CHECK (public.is_internal_user((select auth.uid()), organization_id));
CREATE POLICY "Tenant internal can delete cashflow accounts"
  ON public.client_cashflow_accounts FOR DELETE TO authenticated
  USING (public.is_internal_user((select auth.uid()), organization_id));

DROP POLICY IF EXISTS "Clients and internal can view cashflow entries" ON public.client_cashflow_entries;
DROP POLICY IF EXISTS "Clients and internal can insert cashflow entries" ON public.client_cashflow_entries;
DROP POLICY IF EXISTS "Clients and internal can update cashflow entries" ON public.client_cashflow_entries;
DROP POLICY IF EXISTS "Clients and internal can delete cashflow entries" ON public.client_cashflow_entries;
CREATE POLICY "Tenant can view cashflow entries"
  ON public.client_cashflow_entries
  FOR SELECT
  TO authenticated
  USING (
    public.is_internal_user((select auth.uid()), organization_id)
    OR public.can_access_client_cashflow(client_id)
  );
CREATE POLICY "Tenant can insert cashflow entries"
  ON public.client_cashflow_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_internal_user((select auth.uid()), organization_id)
    OR (created_by = (select auth.uid()) AND public.can_access_client_cashflow(client_id))
  );
CREATE POLICY "Tenant can update cashflow entries"
  ON public.client_cashflow_entries
  FOR UPDATE
  TO authenticated
  USING (
    public.is_internal_user((select auth.uid()), organization_id)
    OR (created_by = (select auth.uid()) AND public.can_access_client_cashflow(client_id))
  )
  WITH CHECK (
    public.is_internal_user((select auth.uid()), organization_id)
    OR (created_by = (select auth.uid()) AND public.can_access_client_cashflow(client_id))
  );
CREATE POLICY "Tenant can delete cashflow entries"
  ON public.client_cashflow_entries
  FOR DELETE
  TO authenticated
  USING (
    public.is_internal_user((select auth.uid()), organization_id)
    OR (created_by = (select auth.uid()) AND public.can_access_client_cashflow(client_id))
  );

DROP POLICY IF EXISTS "Internal can manage cashflow rules" ON public.client_cashflow_rules;
DROP POLICY IF EXISTS "Internal can view cashflow rules" ON public.client_cashflow_rules;
CREATE POLICY "Tenant internal can manage cashflow rules"
  ON public.client_cashflow_rules
  FOR ALL
  TO authenticated
  USING (public.is_internal_user((select auth.uid()), organization_id))
  WITH CHECK (public.is_internal_user((select auth.uid()), organization_id));

DROP POLICY IF EXISTS "Internal can manage consultive cashflow alerts" ON public.client_cashflow_consultive_alerts;
DROP POLICY IF EXISTS "Client and internal can view consultive cashflow alerts" ON public.client_cashflow_consultive_alerts;
CREATE POLICY "Tenant can view consultive cashflow alerts"
  ON public.client_cashflow_consultive_alerts
  FOR SELECT
  TO authenticated
  USING (
    public.is_internal_user((select auth.uid()), organization_id)
    OR public.can_access_client_cashflow(client_id)
  );
CREATE POLICY "Tenant internal can manage consultive cashflow alerts"
  ON public.client_cashflow_consultive_alerts
  FOR ALL
  TO authenticated
  USING (public.is_internal_user((select auth.uid()), organization_id))
  WITH CHECK (public.is_internal_user((select auth.uid()), organization_id));

DROP POLICY IF EXISTS "Internal can manage cashflow health snapshots" ON public.client_cashflow_health_snapshots;
DROP POLICY IF EXISTS "Client and internal can view cashflow health snapshots" ON public.client_cashflow_health_snapshots;
CREATE POLICY "Tenant can view cashflow health snapshots"
  ON public.client_cashflow_health_snapshots
  FOR SELECT
  TO authenticated
  USING (
    public.is_internal_user((select auth.uid()), organization_id)
    OR public.can_access_client_cashflow(client_id)
  );
CREATE POLICY "Tenant internal can manage cashflow health snapshots"
  ON public.client_cashflow_health_snapshots
  FOR ALL
  TO authenticated
  USING (public.is_internal_user((select auth.uid()), organization_id))
  WITH CHECK (public.is_internal_user((select auth.uid()), organization_id));

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'open_finance_connections',
    'open_finance_accounts',
    'open_finance_transactions'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Client and internal can view %s" ON public.%I', replace(table_name, '_', ' '), table_name);
    EXECUTE format('DROP POLICY IF EXISTS "Internal can manage %s" ON public.%I', replace(table_name, '_', ' '), table_name);
  END LOOP;
END
$$;

DROP POLICY IF EXISTS "Client and internal can view open finance connections" ON public.open_finance_connections;
DROP POLICY IF EXISTS "Internal can manage open finance connections" ON public.open_finance_connections;
CREATE POLICY "Tenant can view open finance connections"
  ON public.open_finance_connections FOR SELECT TO authenticated
  USING (public.is_internal_user((select auth.uid()), organization_id) OR public.can_access_client_open_finance(client_id));
CREATE POLICY "Tenant internal can manage open finance connections"
  ON public.open_finance_connections FOR ALL TO authenticated
  USING (public.is_internal_user((select auth.uid()), organization_id))
  WITH CHECK (public.is_internal_user((select auth.uid()), organization_id));

DROP POLICY IF EXISTS "Client and internal can view open finance accounts" ON public.open_finance_accounts;
DROP POLICY IF EXISTS "Internal can manage open finance accounts" ON public.open_finance_accounts;
CREATE POLICY "Tenant can view open finance accounts"
  ON public.open_finance_accounts FOR SELECT TO authenticated
  USING (public.is_internal_user((select auth.uid()), organization_id) OR public.can_access_client_open_finance(client_id));
CREATE POLICY "Tenant internal can manage open finance accounts"
  ON public.open_finance_accounts FOR ALL TO authenticated
  USING (public.is_internal_user((select auth.uid()), organization_id))
  WITH CHECK (public.is_internal_user((select auth.uid()), organization_id));

DROP POLICY IF EXISTS "Client and internal can view open finance transactions" ON public.open_finance_transactions;
DROP POLICY IF EXISTS "Internal can manage open finance transactions" ON public.open_finance_transactions;
CREATE POLICY "Tenant can view open finance transactions"
  ON public.open_finance_transactions FOR SELECT TO authenticated
  USING (public.is_internal_user((select auth.uid()), organization_id) OR public.can_access_client_open_finance(client_id));
CREATE POLICY "Tenant internal can manage open finance transactions"
  ON public.open_finance_transactions FOR ALL TO authenticated
  USING (public.is_internal_user((select auth.uid()), organization_id))
  WITH CHECK (public.is_internal_user((select auth.uid()), organization_id));

DROP POLICY IF EXISTS "Internal can view open finance webhook events" ON public.open_finance_webhook_events;
DROP POLICY IF EXISTS "Internal can manage open finance webhook events" ON public.open_finance_webhook_events;
CREATE POLICY "Tenant internal can manage open finance webhook events"
  ON public.open_finance_webhook_events
  FOR ALL
  TO authenticated
  USING (public.is_internal_user((select auth.uid()), organization_id))
  WITH CHECK (public.is_internal_user((select auth.uid()), organization_id));

-- Obligations and document ingestion
DROP POLICY IF EXISTS "Internal can view obligation profiles" ON public.client_obligation_profiles;
DROP POLICY IF EXISTS "Internal can manage obligation profiles" ON public.client_obligation_profiles;
CREATE POLICY "Tenant internal can manage obligation profiles"
  ON public.client_obligation_profiles
  FOR ALL TO authenticated
  USING (public.is_internal_user((select auth.uid()), organization_id))
  WITH CHECK (public.is_internal_user((select auth.uid()), organization_id));

DROP POLICY IF EXISTS "Clients can view own obligation instances" ON public.obligation_instances;
DROP POLICY IF EXISTS "Internal can view obligation instances" ON public.obligation_instances;
DROP POLICY IF EXISTS "Internal can manage obligation instances" ON public.obligation_instances;
CREATE POLICY "Tenant can view obligation instances"
  ON public.obligation_instances
  FOR SELECT TO authenticated
  USING (
    public.is_internal_user((select auth.uid()), organization_id)
    OR public.can_access_client((select auth.uid()), client_id)
  );
CREATE POLICY "Tenant internal can manage obligation instances"
  ON public.obligation_instances
  FOR ALL TO authenticated
  USING (public.is_internal_user((select auth.uid()), organization_id))
  WITH CHECK (public.is_internal_user((select auth.uid()), organization_id));

DROP POLICY IF EXISTS "Clients can view own obligation templates" ON public.obligation_templates;
DROP POLICY IF EXISTS "Internal can view obligation templates" ON public.obligation_templates;
DROP POLICY IF EXISTS "Managers can manage obligation templates" ON public.obligation_templates;
CREATE POLICY "Tenant can view obligation templates"
  ON public.obligation_templates
  FOR SELECT TO authenticated
  USING (
    public.is_internal_user((select auth.uid()), organization_id)
    OR EXISTS (
      SELECT 1
      FROM public.obligation_instances oi
      WHERE oi.template_id = obligation_templates.id
        AND oi.organization_id = obligation_templates.organization_id
        AND public.can_access_client((select auth.uid()), oi.client_id)
    )
  );
CREATE POLICY "Tenant managers can manage obligation templates"
  ON public.obligation_templates
  FOR ALL TO authenticated
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

DROP POLICY IF EXISTS "Internal can view obligation events" ON public.obligation_instance_events;
DROP POLICY IF EXISTS "Internal can manage obligation events" ON public.obligation_instance_events;
CREATE POLICY "Tenant internal can manage obligation events"
  ON public.obligation_instance_events
  FOR ALL TO authenticated
  USING (public.is_internal_user((select auth.uid()), organization_id))
  WITH CHECK (public.is_internal_user((select auth.uid()), organization_id));

DROP POLICY IF EXISTS "Clients can view own obligation files" ON public.obligation_instance_files;
DROP POLICY IF EXISTS "Internal can view obligation files" ON public.obligation_instance_files;
DROP POLICY IF EXISTS "Internal can manage obligation files" ON public.obligation_instance_files;
CREATE POLICY "Tenant can view obligation files"
  ON public.obligation_instance_files
  FOR SELECT TO authenticated
  USING (
    public.is_internal_user((select auth.uid()), organization_id)
    OR EXISTS (
      SELECT 1
      FROM public.obligation_instances oi
      WHERE oi.id = obligation_instance_files.instance_id
        AND oi.organization_id = obligation_instance_files.organization_id
        AND public.can_access_client((select auth.uid()), oi.client_id)
    )
  );
CREATE POLICY "Tenant internal can manage obligation files"
  ON public.obligation_instance_files
  FOR ALL TO authenticated
  USING (public.is_internal_user((select auth.uid()), organization_id))
  WITH CHECK (public.is_internal_user((select auth.uid()), organization_id));

DROP POLICY IF EXISTS "Internal can view document inbox items" ON public.document_inbox_items;
DROP POLICY IF EXISTS "Internal can manage document inbox items" ON public.document_inbox_items;
CREATE POLICY "Tenant internal can manage document inbox items"
  ON public.document_inbox_items
  FOR ALL TO authenticated
  USING (public.is_internal_user((select auth.uid()), organization_id))
  WITH CHECK (public.is_internal_user((select auth.uid()), organization_id));

DROP POLICY IF EXISTS "Internal can view document ingestion jobs" ON public.document_ingestion_jobs;
DROP POLICY IF EXISTS "Internal can manage document ingestion jobs" ON public.document_ingestion_jobs;
CREATE POLICY "Tenant internal can manage document ingestion jobs"
  ON public.document_ingestion_jobs
  FOR ALL TO authenticated
  USING (public.is_internal_user((select auth.uid()), organization_id))
  WITH CHECK (public.is_internal_user((select auth.uid()), organization_id));

DROP POLICY IF EXISTS "Internal can view expected document reference files" ON public.expected_document_reference_files;
DROP POLICY IF EXISTS "Internal can manage expected document reference files" ON public.expected_document_reference_files;
CREATE POLICY "Tenant internal can manage expected document reference files"
  ON public.expected_document_reference_files
  FOR ALL TO authenticated
  USING (public.is_internal_user((select auth.uid()), organization_id))
  WITH CHECK (public.is_internal_user((select auth.uid()), organization_id));

-- Legacy user-owned tables: keep behavior, optimize auth.uid() and restrict to authenticated.
DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can delete own transactions" ON public.transactions;
CREATE POLICY "Users can view own transactions" ON public.transactions FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can insert own transactions" ON public.transactions FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can update own transactions" ON public.transactions FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can delete own transactions" ON public.transactions FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own goals" ON public.monthly_goals;
DROP POLICY IF EXISTS "Users can insert own goals" ON public.monthly_goals;
DROP POLICY IF EXISTS "Users can update own goals" ON public.monthly_goals;
DROP POLICY IF EXISTS "Users can delete own goals" ON public.monthly_goals;
CREATE POLICY "Users can view own goals" ON public.monthly_goals FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can insert own goals" ON public.monthly_goals FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can update own goals" ON public.monthly_goals FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can delete own goals" ON public.monthly_goals FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own saved reports" ON public.saved_reports;
DROP POLICY IF EXISTS "Users can insert own saved reports" ON public.saved_reports;
DROP POLICY IF EXISTS "Users can update own saved reports" ON public.saved_reports;
DROP POLICY IF EXISTS "Users can delete own saved reports" ON public.saved_reports;
CREATE POLICY "Users can view own saved reports" ON public.saved_reports FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can insert own saved reports" ON public.saved_reports FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can update own saved reports" ON public.saved_reports FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can delete own saved reports" ON public.saved_reports FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Admins can view all settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can view own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
CREATE POLICY "Tenant can view user settings"
  ON public.user_settings FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id OR public.has_org_role((select auth.uid()), organization_id, 'admin'));
CREATE POLICY "Users can insert own settings"
  ON public.user_settings FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can update own settings"
  ON public.user_settings FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- Process documents: same internal-only behavior, cheaper policies.
DROP POLICY IF EXISTS "Internal team can view process documents" ON public.process_documents;
DROP POLICY IF EXISTS "Internal team can insert process documents" ON public.process_documents;
DROP POLICY IF EXISTS "Internal team can update process documents" ON public.process_documents;
DROP POLICY IF EXISTS "Internal team can delete process documents" ON public.process_documents;
CREATE POLICY "Internal team can view process documents"
  ON public.process_documents FOR SELECT TO authenticated
  USING (public.is_internal_user((select auth.uid())));
CREATE POLICY "Internal team can insert process documents"
  ON public.process_documents FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_user((select auth.uid())) AND (created_by IS NULL OR created_by = (select auth.uid())));
CREATE POLICY "Internal team can update process documents"
  ON public.process_documents FOR UPDATE TO authenticated
  USING (public.is_internal_user((select auth.uid())))
  WITH CHECK (public.is_internal_user((select auth.uid())));
CREATE POLICY "Internal team can delete process documents"
  ON public.process_documents FOR DELETE TO authenticated
  USING (public.is_internal_user((select auth.uid())));

-- Replace manage policies that would otherwise overlap SELECT through FOR ALL.
DROP POLICY IF EXISTS "Tenant internal can manage consultive cashflow alerts" ON public.client_cashflow_consultive_alerts;
CREATE POLICY "Tenant internal can insert consultive cashflow alerts"
  ON public.client_cashflow_consultive_alerts FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_user((select auth.uid()), organization_id));
CREATE POLICY "Tenant internal can update consultive cashflow alerts"
  ON public.client_cashflow_consultive_alerts FOR UPDATE TO authenticated
  USING (public.is_internal_user((select auth.uid()), organization_id))
  WITH CHECK (public.is_internal_user((select auth.uid()), organization_id));
CREATE POLICY "Tenant internal can delete consultive cashflow alerts"
  ON public.client_cashflow_consultive_alerts FOR DELETE TO authenticated
  USING (public.is_internal_user((select auth.uid()), organization_id));

DROP POLICY IF EXISTS "Tenant internal can manage cashflow health snapshots" ON public.client_cashflow_health_snapshots;
CREATE POLICY "Tenant internal can insert cashflow health snapshots"
  ON public.client_cashflow_health_snapshots FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_user((select auth.uid()), organization_id));
CREATE POLICY "Tenant internal can update cashflow health snapshots"
  ON public.client_cashflow_health_snapshots FOR UPDATE TO authenticated
  USING (public.is_internal_user((select auth.uid()), organization_id))
  WITH CHECK (public.is_internal_user((select auth.uid()), organization_id));
CREATE POLICY "Tenant internal can delete cashflow health snapshots"
  ON public.client_cashflow_health_snapshots FOR DELETE TO authenticated
  USING (public.is_internal_user((select auth.uid()), organization_id));

DROP POLICY IF EXISTS "Tenant internal can manage open finance connections" ON public.open_finance_connections;
CREATE POLICY "Tenant internal can insert open finance connections"
  ON public.open_finance_connections FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_user((select auth.uid()), organization_id));
CREATE POLICY "Tenant internal can update open finance connections"
  ON public.open_finance_connections FOR UPDATE TO authenticated
  USING (public.is_internal_user((select auth.uid()), organization_id))
  WITH CHECK (public.is_internal_user((select auth.uid()), organization_id));
CREATE POLICY "Tenant internal can delete open finance connections"
  ON public.open_finance_connections FOR DELETE TO authenticated
  USING (public.is_internal_user((select auth.uid()), organization_id));

DROP POLICY IF EXISTS "Tenant internal can manage open finance accounts" ON public.open_finance_accounts;
CREATE POLICY "Tenant internal can insert open finance accounts"
  ON public.open_finance_accounts FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_user((select auth.uid()), organization_id));
CREATE POLICY "Tenant internal can update open finance accounts"
  ON public.open_finance_accounts FOR UPDATE TO authenticated
  USING (public.is_internal_user((select auth.uid()), organization_id))
  WITH CHECK (public.is_internal_user((select auth.uid()), organization_id));
CREATE POLICY "Tenant internal can delete open finance accounts"
  ON public.open_finance_accounts FOR DELETE TO authenticated
  USING (public.is_internal_user((select auth.uid()), organization_id));

DROP POLICY IF EXISTS "Tenant internal can manage open finance transactions" ON public.open_finance_transactions;
CREATE POLICY "Tenant internal can insert open finance transactions"
  ON public.open_finance_transactions FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_user((select auth.uid()), organization_id));
CREATE POLICY "Tenant internal can update open finance transactions"
  ON public.open_finance_transactions FOR UPDATE TO authenticated
  USING (public.is_internal_user((select auth.uid()), organization_id))
  WITH CHECK (public.is_internal_user((select auth.uid()), organization_id));
CREATE POLICY "Tenant internal can delete open finance transactions"
  ON public.open_finance_transactions FOR DELETE TO authenticated
  USING (public.is_internal_user((select auth.uid()), organization_id));

DROP POLICY IF EXISTS "Tenant internal can manage obligation instances" ON public.obligation_instances;
CREATE POLICY "Tenant internal can insert obligation instances"
  ON public.obligation_instances FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_user((select auth.uid()), organization_id));
CREATE POLICY "Tenant internal can update obligation instances"
  ON public.obligation_instances FOR UPDATE TO authenticated
  USING (public.is_internal_user((select auth.uid()), organization_id))
  WITH CHECK (public.is_internal_user((select auth.uid()), organization_id));
CREATE POLICY "Tenant internal can delete obligation instances"
  ON public.obligation_instances FOR DELETE TO authenticated
  USING (public.is_internal_user((select auth.uid()), organization_id));

DROP POLICY IF EXISTS "Tenant managers can manage obligation templates" ON public.obligation_templates;
CREATE POLICY "Tenant managers can insert obligation templates"
  ON public.obligation_templates FOR INSERT TO authenticated
  WITH CHECK (
    public.has_org_role((select auth.uid()), organization_id, 'admin')
    OR public.has_org_role((select auth.uid()), organization_id, 'director')
    OR public.has_org_role((select auth.uid()), organization_id, 'manager')
  );
CREATE POLICY "Tenant managers can update obligation templates"
  ON public.obligation_templates FOR UPDATE TO authenticated
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
CREATE POLICY "Tenant managers can delete obligation templates"
  ON public.obligation_templates FOR DELETE TO authenticated
  USING (
    public.has_org_role((select auth.uid()), organization_id, 'admin')
    OR public.has_org_role((select auth.uid()), organization_id, 'director')
    OR public.has_org_role((select auth.uid()), organization_id, 'manager')
  );

DROP POLICY IF EXISTS "Tenant internal can manage obligation files" ON public.obligation_instance_files;
CREATE POLICY "Tenant internal can insert obligation files"
  ON public.obligation_instance_files FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_user((select auth.uid()), organization_id));
CREATE POLICY "Tenant internal can update obligation files"
  ON public.obligation_instance_files FOR UPDATE TO authenticated
  USING (public.is_internal_user((select auth.uid()), organization_id))
  WITH CHECK (public.is_internal_user((select auth.uid()), organization_id));
CREATE POLICY "Tenant internal can delete obligation files"
  ON public.obligation_instance_files FOR DELETE TO authenticated
  USING (public.is_internal_user((select auth.uid()), organization_id));
