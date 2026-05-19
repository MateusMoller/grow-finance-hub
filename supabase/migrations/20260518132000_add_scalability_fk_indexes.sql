-- Add missing foreign-key and ownership indexes used by high-volume tenant flows.

DO $$
DECLARE
  item record;
  columns_ok boolean;
BEGIN
  FOR item IN
    SELECT *
    FROM (
      VALUES
        ('ai_action_logs', 'user_id', 'idx_ai_action_logs_user_id'),
        ('calendar_events', 'created_by', 'idx_calendar_events_created_by'),
        ('client_cashflow_accounts', 'open_finance_connection_id', 'idx_client_cashflow_accounts_open_finance_connection_id'),
        ('client_cashflow_entries', 'created_by', 'idx_client_cashflow_entries_created_by'),
        ('client_cashflow_rules', 'created_by', 'idx_client_cashflow_rules_created_by'),
        ('client_cashflow_rules', 'updated_by', 'idx_client_cashflow_rules_updated_by'),
        ('client_documents', 'request_id', 'idx_client_documents_request_id'),
        ('client_documents', 'user_id', 'idx_client_documents_user_id'),
        ('client_documents', 'processed_by', 'idx_client_documents_processed_by'),
        ('client_files', 'client_id', 'idx_client_files_client_id'),
        ('client_portal_tasks', 'request_id', 'idx_client_portal_tasks_request_id'),
        ('client_portal_tasks', 'created_by', 'idx_client_portal_tasks_created_by'),
        ('client_requests', 'user_id', 'idx_client_requests_user_id'),
        ('crm_goals', 'created_by', 'idx_crm_goals_created_by'),
        ('crm_goals', 'updated_by', 'idx_crm_goals_updated_by'),
        ('crm_lead_events', 'lead_id', 'idx_crm_lead_events_lead_id'),
        ('crm_lead_events', 'actor_user_id', 'idx_crm_lead_events_actor_user_id'),
        ('crm_leads', 'created_by', 'idx_crm_leads_created_by'),
        ('crm_leads', 'updated_by', 'idx_crm_leads_updated_by'),
        ('document_inbox_items', 'suggested_client_id', 'idx_document_inbox_items_suggested_client_id'),
        ('document_inbox_items', 'suggested_template_id', 'idx_document_inbox_items_suggested_template_id'),
        ('document_inbox_items', 'suggested_instance_id', 'idx_document_inbox_items_suggested_instance_id'),
        ('document_inbox_items', 'linked_instance_id', 'idx_document_inbox_items_linked_instance_id'),
        ('document_ingestion_jobs', 'detected_client_id', 'idx_document_ingestion_jobs_detected_client_id'),
        ('document_ingestion_jobs', 'template_id', 'idx_document_ingestion_jobs_template_id'),
        ('document_ingestion_jobs', 'instance_id', 'idx_document_ingestion_jobs_instance_id'),
        ('document_ingestion_jobs', 'inbox_item_id', 'idx_document_ingestion_jobs_inbox_item_id'),
        ('obligation_instance_events', 'instance_id', 'idx_obligation_instance_events_instance_id'),
        ('obligation_instance_files', 'instance_id', 'idx_obligation_instance_files_instance_id'),
        ('obligation_instance_files', 'inbox_item_id', 'idx_obligation_instance_files_inbox_item_id'),
        ('open_finance_accounts', 'client_id', 'idx_open_finance_accounts_client_id'),
        ('open_finance_transactions', 'client_id', 'idx_open_finance_transactions_client_id'),
        ('open_finance_transactions', 'account_id', 'idx_open_finance_transactions_account_id')
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
