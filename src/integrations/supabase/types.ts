/* eslint-disable @typescript-eslint/no-explicit-any */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

type GenericTable = {
  Row: Record<string, any>
  Insert: Record<string, any>
  Update: Record<string, any>
  Relationships: []
}

type GenericFunction = {
  Args: Record<string, any>
  Returns: any
}

type SavedReportsTable = {
  Row: {
    id: string
    organization_id: string
    user_id: string
    name: string
    normalized_name: string | null
    dataset_id: string
    column_keys: string[]
    format: string
    auto_generate: boolean
    created_at: string
    updated_at: string
  }
  Insert: {
    id?: string
    organization_id?: string
    user_id: string
    name: string
    normalized_name?: string | null
    dataset_id: string
    column_keys: string[]
    format?: string
    auto_generate?: boolean
    created_at?: string
    updated_at?: string
  }
  Update: {
    id?: string
    organization_id?: string
    user_id?: string
    name?: string
    normalized_name?: string | null
    dataset_id?: string
    column_keys?: string[]
    format?: string
    auto_generate?: boolean
    created_at?: string
    updated_at?: string
  }
  Relationships: []
}

type TaxRegimeDefinitionsTable = {
  Row: {
    id: string
    organization_id: string
    code: string
    label: string
    aliases: string[]
    is_active: boolean
    sort_order: number
    created_at: string
    updated_at: string
  }
  Insert: Partial<TaxRegimeDefinitionsTable["Row"]> & {
    code: string
    label: string
  }
  Update: Partial<TaxRegimeDefinitionsTable["Row"]>
  Relationships: []
}

type ObligationRegimeLoadsTable = {
  Row: {
    id: string
    organization_id: string
    tax_regime_code: string
    name: string
    status: string
    version: number
    description: string | null
    owner_sector: string | null
    review_notes: string | null
    effective_from: string
    effective_until: string | null
    created_by: string | null
    updated_by: string | null
    created_at: string
    updated_at: string
  }
  Insert: Partial<ObligationRegimeLoadsTable["Row"]> & {
    tax_regime_code: string
    name: string
  }
  Update: Partial<ObligationRegimeLoadsTable["Row"]>
  Relationships: []
}

type ObligationRegimeLoadItemsTable = {
  Row: {
    id: string
    organization_id: string
    load_id: string
    template_id: string
    applicability: string
    condition_key: string | null
    default_start_policy: string
    default_due_day_override: number | null
    notes: string | null
    is_active: boolean
    sort_order: number
    created_by: string | null
    updated_by: string | null
    created_at: string
    updated_at: string
  }
  Insert: Partial<ObligationRegimeLoadItemsTable["Row"]> & {
    load_id: string
    template_id: string
  }
  Update: Partial<ObligationRegimeLoadItemsTable["Row"]>
  Relationships: []
}

type ObligationLoadApplicationBatchesTable = {
  Row: {
    id: string
    organization_id: string
    client_id: string | null
    tax_regime_code: string
    load_id: string | null
    mode: string
    sync_scope: string
    status: string
    summary: Json
    warnings: Json
    created_by: string | null
    applied_by: string | null
    created_at: string
    applied_at: string | null
  }
  Insert: Partial<ObligationLoadApplicationBatchesTable["Row"]> & {
    tax_regime_code: string
    mode: string
  }
  Update: Partial<ObligationLoadApplicationBatchesTable["Row"]>
  Relationships: []
}

type ObligationLoadApplicationReviewsTable = GenericTable
type ObligationLoadSyncRunsTable = GenericTable
type ObligationAuditEventsTable = GenericTable

export type Database = {
  public: {
    Tables: {
      acessorias_companies_cache: GenericTable
      ai_action_logs: GenericTable
      ai_duplicate_checks: GenericTable
      ai_interactions: GenericTable
      calendar_events: GenericTable
      client_acessorias_links: GenericTable
      client_acessorias_obligations: GenericTable
      client_acessorias_uploads: GenericTable
      client_cashflow_accounts: GenericTable
      client_cashflow_consultive_alerts: GenericTable
      client_cashflow_entries: GenericTable
      client_cashflow_health_snapshots: GenericTable
      client_cashflow_rules: GenericTable
      client_data: GenericTable
      client_documents: GenericTable
      client_files: GenericTable
      client_obligation_profiles: GenericTable
      client_portal_tasks: GenericTable
      client_requests: GenericTable
      client_users: GenericTable
      clients: GenericTable
      cnpj_lookup_cache: GenericTable
      crm_goals: GenericTable
      crm_lead_events: GenericTable
      crm_leads: GenericTable
      document_inbox_items: GenericTable
      document_ingestion_jobs: GenericTable
      email_inbox_messages: GenericTable
      expected_document_reference_files: GenericTable
      form_submissions: GenericTable
      form_templates: GenericTable
      integration_api_credentials: GenericTable
      internal_chat_messages: GenericTable
      kanban_task_comments: GenericTable
      kanban_tasks: GenericTable
      kb_chunks: GenericTable
      kb_documents: GenericTable
      manual_user_progress: GenericTable
      manual_user_state: GenericTable
      monthly_goals: GenericTable
      newsletter_subscribers: GenericTable
      newsletters: GenericTable
      obligation_instance_events: GenericTable
      obligation_instance_files: GenericTable
      obligation_instances: GenericTable
      obligation_templates: GenericTable
      operational_audit_logs: GenericTable
      open_finance_accounts: GenericTable
      open_finance_connections: GenericTable
      open_finance_transactions: GenericTable
      open_finance_webhook_events: GenericTable
      organization_settings: GenericTable
      organizations: GenericTable
      process_documents: GenericTable
      profiles: GenericTable
      push_subscriptions: GenericTable
      request_messages: GenericTable
      saved_reports: SavedReportsTable
      site_leads: GenericTable
      tax_regime_definitions: TaxRegimeDefinitionsTable
      transactions: GenericTable
      user_access_control: GenericTable
      user_profiles: GenericTable
      user_roles: GenericTable
      user_settings: GenericTable
      whatsapp_webhook_logs: GenericTable
      obligation_regime_loads: ObligationRegimeLoadsTable
      obligation_regime_load_items: ObligationRegimeLoadItemsTable
      obligation_load_application_batches: ObligationLoadApplicationBatchesTable
      obligation_load_application_reviews: ObligationLoadApplicationReviewsTable
      obligation_load_sync_runs: ObligationLoadSyncRunsTable
      obligation_audit_events: ObligationAuditEventsTable
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_cashflow_rule_match: GenericFunction
      can_access_client_cashflow: GenericFunction
      can_access_client_open_finance: GenericFunction
      can_access_client: GenericFunction
      cleanup_open_finance_transactions: GenericFunction
      create_kanban_from_request: GenericFunction
      current_organization_id: GenericFunction
      enforce_admin_cashflow_release: GenericFunction
      enforce_clients_uniqueness_guard: GenericFunction
      find_matching_cashflow_rule: GenericFunction
      get_manual_adoption_snapshot: GenericFunction
      has_org_role: GenericFunction
      has_role: GenericFunction
      infer_cashflow_category_from_obligation: GenericFunction
      is_grow_admin: GenericFunction
      is_internal_user: GenericFunction
      list_admin_users: GenericFunction
      list_internal_user_profiles: GenericFunction
      normalize_cashflow_match_text: GenericFunction
      prevent_internal_user_client_link: GenericFunction
      prevent_mixed_portal_internal_roles: GenericFunction
      refresh_client_cashflow_consultive_state: GenericFunction
      record_operational_audit_log: GenericFunction
      resolve_cashflow_consultive_alerts: GenericFunction
      resolve_cashflow_consultive_tasks: GenericFunction
      revoke_inactive_client_access: GenericFunction
      search_kb_chunks: GenericFunction
      sync_cashflow_projection_from_obligation: GenericFunction
      sync_client_cashflow_entry_phase1_fields: GenericFunction
      update_updated_at_column: GenericFunction
      upsert_cashflow_consultive_task: GenericFunction
      upsert_client_cashflow_consultive_alert: GenericFunction
    }
    Enums: {
      app_role:
        | "admin"
        | "director"
        | "manager"
        | "employee"
        | "commercial"
        | "client"
        | "partner"
        | "departamento_pessoal"
        | "fiscal"
        | "contabil"
      request_status: "pending" | "in_progress" | "completed" | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "director",
        "manager",
        "employee",
        "commercial",
        "client",
        "partner",
        "departamento_pessoal",
        "fiscal",
        "contabil",
      ],
      request_status: ["pending", "in_progress", "completed", "cancelled"],
    },
  },
} as const
