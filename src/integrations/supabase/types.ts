export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      acessorias_companies_cache: {
        Row: {
          acessorias_company_id: string;
          cnpj: string | null;
          company_name: string;
          created_at: string;
          id: string;
          last_synced_at: string;
          organization_id: string;
          raw_payload: Json;
          status: string | null;
          updated_at: string;
        };
        Insert: {
          acessorias_company_id: string;
          cnpj?: string | null;
          company_name: string;
          created_at?: string;
          id?: string;
          last_synced_at?: string;
          organization_id?: string;
          raw_payload?: Json;
          status?: string | null;
          updated_at?: string;
        };
        Update: {
          acessorias_company_id?: string;
          cnpj?: string | null;
          company_name?: string;
          created_at?: string;
          id?: string;
          last_synced_at?: string;
          organization_id?: string;
          raw_payload?: Json;
          status?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "acessorias_companies_cache_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_action_logs: {
        Row: {
          action_payload: Json;
          action_result: Json;
          action_type: string;
          channel: string | null;
          cliente_id: string;
          confirmation_expires_at: string | null;
          confirmed_at: string | null;
          created_at: string;
          executed_at: string | null;
          external_reference: string | null;
          id: string;
          organization_id: string;
          requires_confirmation: boolean;
          requires_human_review: boolean;
          risk_level: string;
          status: string;
          user_id: string;
        };
        Insert: {
          action_payload?: Json;
          action_result?: Json;
          action_type: string;
          channel?: string | null;
          cliente_id: string;
          confirmation_expires_at?: string | null;
          confirmed_at?: string | null;
          created_at?: string;
          executed_at?: string | null;
          external_reference?: string | null;
          id?: string;
          organization_id?: string;
          requires_confirmation?: boolean;
          requires_human_review?: boolean;
          risk_level?: string;
          status?: string;
          user_id: string;
        };
        Update: {
          action_payload?: Json;
          action_result?: Json;
          action_type?: string;
          channel?: string | null;
          cliente_id?: string;
          confirmation_expires_at?: string | null;
          confirmed_at?: string | null;
          created_at?: string;
          executed_at?: string | null;
          external_reference?: string | null;
          id?: string;
          organization_id?: string;
          requires_confirmation?: boolean;
          requires_human_review?: boolean;
          risk_level?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_action_logs_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "acessorias_report_overview";
            referencedColumns: ["client_id"];
          },
          {
            foreignKeyName: "ai_action_logs_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_action_logs_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_duplicate_checks: {
        Row: {
          cliente_id: string;
          confidence_level: string;
          created_at: string;
          id: string;
          matched_id: string | null;
          matched_type: string | null;
          organization_id: string;
          reason: string | null;
          recommended_action: string | null;
          source_id: string | null;
          source_type: string;
        };
        Insert: {
          cliente_id: string;
          confidence_level?: string;
          created_at?: string;
          id?: string;
          matched_id?: string | null;
          matched_type?: string | null;
          organization_id?: string;
          reason?: string | null;
          recommended_action?: string | null;
          source_id?: string | null;
          source_type: string;
        };
        Update: {
          cliente_id?: string;
          confidence_level?: string;
          created_at?: string;
          id?: string;
          matched_id?: string | null;
          matched_type?: string | null;
          organization_id?: string;
          reason?: string | null;
          recommended_action?: string | null;
          source_id?: string | null;
          source_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_duplicate_checks_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "acessorias_report_overview";
            referencedColumns: ["client_id"];
          },
          {
            foreignKeyName: "ai_duplicate_checks_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_duplicate_checks_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_interactions: {
        Row: {
          action_executed: Json;
          action_requested: Json;
          ai_response: string | null;
          channel: string;
          cliente_id: string;
          created_at: string;
          detected_intent: string | null;
          id: string;
          organization_id: string;
          requires_human_review: boolean;
          risk_level: string;
          updated_at: string;
          user_id: string;
          user_message: string;
        };
        Insert: {
          action_executed?: Json;
          action_requested?: Json;
          ai_response?: string | null;
          channel: string;
          cliente_id: string;
          created_at?: string;
          detected_intent?: string | null;
          id?: string;
          organization_id?: string;
          requires_human_review?: boolean;
          risk_level?: string;
          updated_at?: string;
          user_id: string;
          user_message: string;
        };
        Update: {
          action_executed?: Json;
          action_requested?: Json;
          ai_response?: string | null;
          channel?: string;
          cliente_id?: string;
          created_at?: string;
          detected_intent?: string | null;
          id?: string;
          organization_id?: string;
          requires_human_review?: boolean;
          risk_level?: string;
          updated_at?: string;
          user_id?: string;
          user_message?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_interactions_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "acessorias_report_overview";
            referencedColumns: ["client_id"];
          },
          {
            foreignKeyName: "ai_interactions_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_interactions_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      calendar_events: {
        Row: {
          all_day: boolean;
          created_at: string;
          created_by: string | null;
          description: string | null;
          due_at: string;
          entry_type: string;
          id: string;
          integration_key: string | null;
          integration_source: string | null;
          organization_id: string;
          priority: string;
          sector: string;
          status: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          all_day?: boolean;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          due_at: string;
          entry_type?: string;
          id?: string;
          integration_key?: string | null;
          integration_source?: string | null;
          organization_id?: string;
          priority?: string;
          sector?: string;
          status?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          all_day?: boolean;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          due_at?: string;
          entry_type?: string;
          id?: string;
          integration_key?: string | null;
          integration_source?: string | null;
          organization_id?: string;
          priority?: string;
          sector?: string;
          status?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "calendar_events_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      client_acessorias_links: {
        Row: {
          acessorias_company_id: string;
          client_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          last_synced_at: string | null;
          match_score: number | null;
          match_type: string;
          notes: string | null;
          organization_id: string;
          updated_at: string;
        };
        Insert: {
          acessorias_company_id: string;
          client_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          last_synced_at?: string | null;
          match_score?: number | null;
          match_type?: string;
          notes?: string | null;
          organization_id?: string;
          updated_at?: string;
        };
        Update: {
          acessorias_company_id?: string;
          client_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          last_synced_at?: string | null;
          match_score?: number | null;
          match_type?: string;
          notes?: string | null;
          organization_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "client_acessorias_links_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: true;
            referencedRelation: "acessorias_report_overview";
            referencedColumns: ["client_id"];
          },
          {
            foreignKeyName: "client_acessorias_links_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: true;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_acessorias_links_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      client_acessorias_obligations: {
        Row: {
          acessorias_company_id: string | null;
          acessorias_obligation_id: string;
          cashflow_account_id: string | null;
          client_id: string;
          created_at: string;
          delivered_at: string | null;
          due_date: string | null;
          financial_category: string | null;
          financial_entry_type: string;
          has_financial_impact: boolean;
          id: string;
          last_synced_at: string;
          notes: string | null;
          obligation_name: string;
          obligation_period: string | null;
          obligation_period_key: string;
          organization_id: string;
          projected_amount: number | null;
          protocol: string | null;
          source_payload: Json;
          status: string | null;
          updated_at: string;
        };
        Insert: {
          acessorias_company_id?: string | null;
          acessorias_obligation_id: string;
          cashflow_account_id?: string | null;
          client_id: string;
          created_at?: string;
          delivered_at?: string | null;
          due_date?: string | null;
          financial_category?: string | null;
          financial_entry_type?: string;
          has_financial_impact?: boolean;
          id?: string;
          last_synced_at?: string;
          notes?: string | null;
          obligation_name: string;
          obligation_period?: string | null;
          obligation_period_key?: string;
          organization_id?: string;
          projected_amount?: number | null;
          protocol?: string | null;
          source_payload?: Json;
          status?: string | null;
          updated_at?: string;
        };
        Update: {
          acessorias_company_id?: string | null;
          acessorias_obligation_id?: string;
          cashflow_account_id?: string | null;
          client_id?: string;
          created_at?: string;
          delivered_at?: string | null;
          due_date?: string | null;
          financial_category?: string | null;
          financial_entry_type?: string;
          has_financial_impact?: boolean;
          id?: string;
          last_synced_at?: string;
          notes?: string | null;
          obligation_name?: string;
          obligation_period?: string | null;
          obligation_period_key?: string;
          organization_id?: string;
          projected_amount?: number | null;
          protocol?: string | null;
          source_payload?: Json;
          status?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "client_acessorias_obligations_cashflow_account_id_fkey";
            columns: ["cashflow_account_id"];
            isOneToOne: false;
            referencedRelation: "client_cashflow_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_acessorias_obligations_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "acessorias_report_overview";
            referencedColumns: ["client_id"];
          },
          {
            foreignKeyName: "client_acessorias_obligations_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_acessorias_obligations_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      client_acessorias_uploads: {
        Row: {
          acessorias_company_id: string | null;
          client_id: string;
          content_type: string | null;
          error_message: string | null;
          file_name: string;
          file_size: number | null;
          id: string;
          organization_id: string;
          request_payload: Json;
          response_payload: Json;
          status: string;
          uploaded_at: string;
          uploaded_by: string | null;
        };
        Insert: {
          acessorias_company_id?: string | null;
          client_id: string;
          content_type?: string | null;
          error_message?: string | null;
          file_name: string;
          file_size?: number | null;
          id?: string;
          organization_id?: string;
          request_payload?: Json;
          response_payload?: Json;
          status?: string;
          uploaded_at?: string;
          uploaded_by?: string | null;
        };
        Update: {
          acessorias_company_id?: string | null;
          client_id?: string;
          content_type?: string | null;
          error_message?: string | null;
          file_name?: string;
          file_size?: number | null;
          id?: string;
          organization_id?: string;
          request_payload?: Json;
          response_payload?: Json;
          status?: string;
          uploaded_at?: string;
          uploaded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "client_acessorias_uploads_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "acessorias_report_overview";
            referencedColumns: ["client_id"];
          },
          {
            foreignKeyName: "client_acessorias_uploads_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_acessorias_uploads_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      client_cashflow_accounts: {
        Row: {
          account_mask: string | null;
          client_id: string;
          created_at: string;
          currency_code: string;
          id: string;
          institution_name: string | null;
          is_active: boolean;
          is_primary: boolean;
          label: string;
          notes: string | null;
          open_finance_account_id: string | null;
          open_finance_connection_id: string | null;
          organization_id: string;
          source_type: string;
          updated_at: string;
        };
        Insert: {
          account_mask?: string | null;
          client_id: string;
          created_at?: string;
          currency_code?: string;
          id?: string;
          institution_name?: string | null;
          is_active?: boolean;
          is_primary?: boolean;
          label: string;
          notes?: string | null;
          open_finance_account_id?: string | null;
          open_finance_connection_id?: string | null;
          organization_id?: string;
          source_type?: string;
          updated_at?: string;
        };
        Update: {
          account_mask?: string | null;
          client_id?: string;
          created_at?: string;
          currency_code?: string;
          id?: string;
          institution_name?: string | null;
          is_active?: boolean;
          is_primary?: boolean;
          label?: string;
          notes?: string | null;
          open_finance_account_id?: string | null;
          open_finance_connection_id?: string | null;
          organization_id?: string;
          source_type?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "client_cashflow_accounts_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "acessorias_report_overview";
            referencedColumns: ["client_id"];
          },
          {
            foreignKeyName: "client_cashflow_accounts_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_cashflow_accounts_open_finance_account_id_fkey";
            columns: ["open_finance_account_id"];
            isOneToOne: false;
            referencedRelation: "open_finance_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_cashflow_accounts_open_finance_connection_id_fkey";
            columns: ["open_finance_connection_id"];
            isOneToOne: false;
            referencedRelation: "open_finance_connections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_cashflow_accounts_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      client_cashflow_consultive_alerts: {
        Row: {
          client_id: string;
          created_at: string;
          id: string;
          message: string;
          metadata: Json;
          organization_id: string;
          resolved_at: string | null;
          severity: string;
          source_key: string;
          source_type: string;
          status: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          client_id: string;
          created_at?: string;
          id?: string;
          message: string;
          metadata?: Json;
          organization_id?: string;
          resolved_at?: string | null;
          severity?: string;
          source_key: string;
          source_type: string;
          status?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          client_id?: string;
          created_at?: string;
          id?: string;
          message?: string;
          metadata?: Json;
          organization_id?: string;
          resolved_at?: string | null;
          severity?: string;
          source_key?: string;
          source_type?: string;
          status?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "client_cashflow_consultive_alerts_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "acessorias_report_overview";
            referencedColumns: ["client_id"];
          },
          {
            foreignKeyName: "client_cashflow_consultive_alerts_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_cashflow_consultive_alerts_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      client_cashflow_entries: {
        Row: {
          account_id: string | null;
          amount: number;
          category: string;
          client_id: string;
          competence_month: string | null;
          counterparty_name: string | null;
          created_at: string;
          created_by: string | null;
          description: string;
          document_ref: string | null;
          due_date: string | null;
          effective_date: string | null;
          entry_date: string;
          entry_type: string;
          id: string;
          integration_account_id: string | null;
          integration_connection_id: string | null;
          integration_key: string | null;
          integration_source: string | null;
          is_hidden_from_projection: boolean;
          is_transfer: boolean;
          lifecycle_status: string | null;
          matched_rule_id: string | null;
          notes: string | null;
          organization_id: string;
          origin_type: string | null;
          reconciliation_status: string | null;
          review_owner_id: string | null;
          review_status: string | null;
          reviewed_at: string | null;
          rule_match_confidence: number | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          account_id?: string | null;
          amount: number;
          category?: string;
          client_id: string;
          competence_month?: string | null;
          counterparty_name?: string | null;
          created_at?: string;
          created_by?: string | null;
          description: string;
          document_ref?: string | null;
          due_date?: string | null;
          effective_date?: string | null;
          entry_date?: string;
          entry_type?: string;
          id?: string;
          integration_account_id?: string | null;
          integration_connection_id?: string | null;
          integration_key?: string | null;
          integration_source?: string | null;
          is_hidden_from_projection?: boolean;
          is_transfer?: boolean;
          lifecycle_status?: string | null;
          matched_rule_id?: string | null;
          notes?: string | null;
          organization_id?: string;
          origin_type?: string | null;
          reconciliation_status?: string | null;
          review_owner_id?: string | null;
          review_status?: string | null;
          reviewed_at?: string | null;
          rule_match_confidence?: number | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          account_id?: string | null;
          amount?: number;
          category?: string;
          client_id?: string;
          competence_month?: string | null;
          counterparty_name?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string;
          document_ref?: string | null;
          due_date?: string | null;
          effective_date?: string | null;
          entry_date?: string;
          entry_type?: string;
          id?: string;
          integration_account_id?: string | null;
          integration_connection_id?: string | null;
          integration_key?: string | null;
          integration_source?: string | null;
          is_hidden_from_projection?: boolean;
          is_transfer?: boolean;
          lifecycle_status?: string | null;
          matched_rule_id?: string | null;
          notes?: string | null;
          organization_id?: string;
          origin_type?: string | null;
          reconciliation_status?: string | null;
          review_owner_id?: string | null;
          review_status?: string | null;
          reviewed_at?: string | null;
          rule_match_confidence?: number | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "client_cashflow_entries_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "client_cashflow_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_cashflow_entries_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "acessorias_report_overview";
            referencedColumns: ["client_id"];
          },
          {
            foreignKeyName: "client_cashflow_entries_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_cashflow_entries_integration_account_id_fkey";
            columns: ["integration_account_id"];
            isOneToOne: false;
            referencedRelation: "open_finance_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_cashflow_entries_integration_connection_id_fkey";
            columns: ["integration_connection_id"];
            isOneToOne: false;
            referencedRelation: "open_finance_connections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_cashflow_entries_matched_rule_id_fkey";
            columns: ["matched_rule_id"];
            isOneToOne: false;
            referencedRelation: "client_cashflow_rules";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_cashflow_entries_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      client_cashflow_health_snapshots: {
        Row: {
          client_id: string;
          critical_calendar_events: number;
          current_balance: number;
          generated_at: string;
          health_status: string;
          last_activity_at: string | null;
          metadata: Json;
          organization_id: string;
          overdue_entries: number;
          pending_reconciliation_entries: number;
          pending_review_entries: number;
          projected_balance_15: number;
          projected_balance_30: number;
          projected_balance_7: number;
          projected_gap_date: string | null;
          review_coverage: number;
          updated_at: string;
        };
        Insert: {
          client_id: string;
          critical_calendar_events?: number;
          current_balance?: number;
          generated_at?: string;
          health_status?: string;
          last_activity_at?: string | null;
          metadata?: Json;
          organization_id?: string;
          overdue_entries?: number;
          pending_reconciliation_entries?: number;
          pending_review_entries?: number;
          projected_balance_15?: number;
          projected_balance_30?: number;
          projected_balance_7?: number;
          projected_gap_date?: string | null;
          review_coverage?: number;
          updated_at?: string;
        };
        Update: {
          client_id?: string;
          critical_calendar_events?: number;
          current_balance?: number;
          generated_at?: string;
          health_status?: string;
          last_activity_at?: string | null;
          metadata?: Json;
          organization_id?: string;
          overdue_entries?: number;
          pending_reconciliation_entries?: number;
          pending_review_entries?: number;
          projected_balance_15?: number;
          projected_balance_30?: number;
          projected_balance_7?: number;
          projected_gap_date?: string | null;
          review_coverage?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "client_cashflow_health_snapshots_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: true;
            referencedRelation: "acessorias_report_overview";
            referencedColumns: ["client_id"];
          },
          {
            foreignKeyName: "client_cashflow_health_snapshots_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: true;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_cashflow_health_snapshots_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      client_cashflow_rules: {
        Row: {
          auto_approve_threshold: number;
          category: string;
          client_id: string | null;
          counterparty_name: string | null;
          created_at: string;
          created_by: string | null;
          entry_type: string;
          id: string;
          is_active: boolean;
          mark_as_transfer: boolean;
          match_text: string;
          notes: string | null;
          organization_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          auto_approve_threshold?: number;
          category: string;
          client_id?: string | null;
          counterparty_name?: string | null;
          created_at?: string;
          created_by?: string | null;
          entry_type?: string;
          id?: string;
          is_active?: boolean;
          mark_as_transfer?: boolean;
          match_text: string;
          notes?: string | null;
          organization_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          auto_approve_threshold?: number;
          category?: string;
          client_id?: string | null;
          counterparty_name?: string | null;
          created_at?: string;
          created_by?: string | null;
          entry_type?: string;
          id?: string;
          is_active?: boolean;
          mark_as_transfer?: boolean;
          match_text?: string;
          notes?: string | null;
          organization_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "client_cashflow_rules_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "acessorias_report_overview";
            referencedColumns: ["client_id"];
          },
          {
            foreignKeyName: "client_cashflow_rules_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_cashflow_rules_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      client_data: {
        Row: {
          category: string;
          client_id: string;
          created_at: string;
          created_by: string | null;
          field_name: string;
          field_value: string | null;
          id: string;
          organization_id: string;
          period: string | null;
          updated_at: string;
        };
        Insert: {
          category?: string;
          client_id: string;
          created_at?: string;
          created_by?: string | null;
          field_name: string;
          field_value?: string | null;
          id?: string;
          organization_id?: string;
          period?: string | null;
          updated_at?: string;
        };
        Update: {
          category?: string;
          client_id?: string;
          created_at?: string;
          created_by?: string | null;
          field_name?: string;
          field_value?: string | null;
          id?: string;
          organization_id?: string;
          period?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "client_data_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "acessorias_report_overview";
            referencedColumns: ["client_id"];
          },
          {
            foreignKeyName: "client_data_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_data_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      client_documents: {
        Row: {
          category: string;
          client_id: string | null;
          created_at: string;
          file_name: string;
          file_path: string;
          file_size: number | null;
          id: string;
          organization_id: string;
          processed_at: string | null;
          processed_by: string | null;
          request_id: string | null;
          user_id: string;
        };
        Insert: {
          category?: string;
          client_id?: string | null;
          created_at?: string;
          file_name: string;
          file_path: string;
          file_size?: number | null;
          id?: string;
          organization_id?: string;
          processed_at?: string | null;
          processed_by?: string | null;
          request_id?: string | null;
          user_id: string;
        };
        Update: {
          category?: string;
          client_id?: string | null;
          created_at?: string;
          file_name?: string;
          file_path?: string;
          file_size?: number | null;
          id?: string;
          organization_id?: string;
          processed_at?: string | null;
          processed_by?: string | null;
          request_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "client_documents_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "acessorias_report_overview";
            referencedColumns: ["client_id"];
          },
          {
            foreignKeyName: "client_documents_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_documents_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_documents_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "client_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      client_files: {
        Row: {
          category: string;
          client_id: string;
          created_at: string;
          file_name: string;
          file_path: string;
          file_size: number | null;
          id: string;
          organization_id: string;
          uploaded_by: string | null;
        };
        Insert: {
          category?: string;
          client_id: string;
          created_at?: string;
          file_name: string;
          file_path: string;
          file_size?: number | null;
          id?: string;
          organization_id?: string;
          uploaded_by?: string | null;
        };
        Update: {
          category?: string;
          client_id?: string;
          created_at?: string;
          file_name?: string;
          file_path?: string;
          file_size?: number | null;
          id?: string;
          organization_id?: string;
          uploaded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "client_files_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "acessorias_report_overview";
            referencedColumns: ["client_id"];
          },
          {
            foreignKeyName: "client_files_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_files_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      client_obligation_profiles: {
        Row: {
          application_batch_id: string | null;
          applied_regime: string | null;
          assigned_to: string | null;
          client_id: string;
          conditional_review_reason: string | null;
          conditional_skip_reason: string | null;
          created_at: string;
          created_by: string | null;
          due_day_override: number | null;
          end_date: string | null;
          expected_documents_override: Json | null;
          id: string;
          inactivation_reason: string | null;
          is_active: boolean;
          legal_due_day_override: number | null;
          notes: string | null;
          organization_id: string;
          parameters: Json;
          source_kind: string;
          source_load_id: string | null;
          source_load_item_id: string | null;
          start_date: string;
          sync_status: string;
          template_id: string;
          updated_at: string;
          yearly_due_month_override: number | null;
        };
        Insert: {
          application_batch_id?: string | null;
          applied_regime?: string | null;
          assigned_to?: string | null;
          client_id: string;
          conditional_review_reason?: string | null;
          conditional_skip_reason?: string | null;
          created_at?: string;
          created_by?: string | null;
          due_day_override?: number | null;
          end_date?: string | null;
          expected_documents_override?: Json | null;
          id?: string;
          inactivation_reason?: string | null;
          is_active?: boolean;
          legal_due_day_override?: number | null;
          notes?: string | null;
          organization_id?: string;
          parameters?: Json;
          source_kind?: string;
          source_load_id?: string | null;
          source_load_item_id?: string | null;
          start_date?: string;
          sync_status?: string;
          template_id: string;
          updated_at?: string;
          yearly_due_month_override?: number | null;
        };
        Update: {
          application_batch_id?: string | null;
          applied_regime?: string | null;
          assigned_to?: string | null;
          client_id?: string;
          conditional_review_reason?: string | null;
          conditional_skip_reason?: string | null;
          created_at?: string;
          created_by?: string | null;
          due_day_override?: number | null;
          end_date?: string | null;
          expected_documents_override?: Json | null;
          id?: string;
          inactivation_reason?: string | null;
          is_active?: boolean;
          legal_due_day_override?: number | null;
          notes?: string | null;
          organization_id?: string;
          parameters?: Json;
          source_kind?: string;
          source_load_id?: string | null;
          source_load_item_id?: string | null;
          start_date?: string;
          sync_status?: string;
          template_id?: string;
          updated_at?: string;
          yearly_due_month_override?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "client_obligation_profiles_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "acessorias_report_overview";
            referencedColumns: ["client_id"];
          },
          {
            foreignKeyName: "client_obligation_profiles_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_obligation_profiles_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_obligation_profiles_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "obligation_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      client_portal_tasks: {
        Row: {
          client_id: string;
          created_at: string;
          created_by: string | null;
          description: string | null;
          due_date: string | null;
          id: string;
          organization_id: string;
          request_id: string | null;
          sector: string;
          status: string;
          title: string;
          type: string;
          updated_at: string;
        };
        Insert: {
          client_id: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          organization_id?: string;
          request_id?: string | null;
          sector?: string;
          status?: string;
          title: string;
          type?: string;
          updated_at?: string;
        };
        Update: {
          client_id?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          organization_id?: string;
          request_id?: string | null;
          sector?: string;
          status?: string;
          title?: string;
          type?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "client_portal_tasks_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "acessorias_report_overview";
            referencedColumns: ["client_id"];
          },
          {
            foreignKeyName: "client_portal_tasks_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_portal_tasks_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_portal_tasks_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "client_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      client_requests: {
        Row: {
          admin_notes: string | null;
          category: string;
          client_id: string | null;
          created_at: string;
          description: string | null;
          id: string;
          organization_id: string;
          sector: string;
          status: Database["public"]["Enums"]["request_status"];
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          admin_notes?: string | null;
          category?: string;
          client_id?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          organization_id?: string;
          sector?: string;
          status?: Database["public"]["Enums"]["request_status"];
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          admin_notes?: string | null;
          category?: string;
          client_id?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          organization_id?: string;
          sector?: string;
          status?: Database["public"]["Enums"]["request_status"];
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "client_requests_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "acessorias_report_overview";
            referencedColumns: ["client_id"];
          },
          {
            foreignKeyName: "client_requests_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_requests_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      client_users: {
        Row: {
          client_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          organization_id: string;
          role: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          client_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          organization_id: string;
          role?: string;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          client_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          organization_id?: string;
          role?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "client_users_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "acessorias_report_overview";
            referencedColumns: ["client_id"];
          },
          {
            foreignKeyName: "client_users_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_users_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      clients: {
        Row: {
          address: string | null;
          client_entity_type: string;
          cnpj: string | null;
          contact: string | null;
          created_at: string;
          created_by: string | null;
          email: string | null;
          id: string;
          name: string;
          notes: string | null;
          obligation_completion_whatsapp_enabled: boolean;
          organization_id: string;
          parent_client_id: string | null;
          phone: string | null;
          portal_cashflow_enabled: boolean;
          portal_user_id: string | null;
          regime: string | null;
          sector: string | null;
          status: string | null;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          client_entity_type?: string;
          cnpj?: string | null;
          contact?: string | null;
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          id?: string;
          name: string;
          notes?: string | null;
          obligation_completion_whatsapp_enabled?: boolean;
          organization_id?: string;
          parent_client_id?: string | null;
          phone?: string | null;
          portal_cashflow_enabled?: boolean;
          portal_user_id?: string | null;
          regime?: string | null;
          sector?: string | null;
          status?: string | null;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          client_entity_type?: string;
          cnpj?: string | null;
          contact?: string | null;
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          id?: string;
          name?: string;
          notes?: string | null;
          obligation_completion_whatsapp_enabled?: boolean;
          organization_id?: string;
          parent_client_id?: string | null;
          phone?: string | null;
          portal_cashflow_enabled?: boolean;
          portal_user_id?: string | null;
          regime?: string | null;
          sector?: string | null;
          status?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clients_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clients_parent_client_id_fkey";
            columns: ["parent_client_id"];
            isOneToOne: false;
            referencedRelation: "acessorias_report_overview";
            referencedColumns: ["client_id"];
          },
          {
            foreignKeyName: "clients_parent_client_id_fkey";
            columns: ["parent_client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      cnpj_lookup_cache: {
        Row: {
          cep: string | null;
          city: string | null;
          cnpj: string;
          created_at: string;
          email: string | null;
          legal_name: string | null;
          main_cnae: string | null;
          neighborhood: string | null;
          number: string | null;
          organization_id: string;
          phone: string | null;
          raw_payload: Json | null;
          source: string | null;
          state: string | null;
          street: string | null;
          trade_name: string | null;
          updated_at: string;
        };
        Insert: {
          cep?: string | null;
          city?: string | null;
          cnpj: string;
          created_at?: string;
          email?: string | null;
          legal_name?: string | null;
          main_cnae?: string | null;
          neighborhood?: string | null;
          number?: string | null;
          organization_id?: string;
          phone?: string | null;
          raw_payload?: Json | null;
          source?: string | null;
          state?: string | null;
          street?: string | null;
          trade_name?: string | null;
          updated_at?: string;
        };
        Update: {
          cep?: string | null;
          city?: string | null;
          cnpj?: string;
          created_at?: string;
          email?: string | null;
          legal_name?: string | null;
          main_cnae?: string | null;
          neighborhood?: string | null;
          number?: string | null;
          organization_id?: string;
          phone?: string | null;
          raw_payload?: Json | null;
          source?: string | null;
          state?: string | null;
          street?: string | null;
          trade_name?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cnpj_lookup_cache_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      crm_goals: {
        Row: {
          competence: string;
          conversion_rate: number;
          created_at: string;
          created_by: string | null;
          id: string;
          organization_id: string;
          updated_at: string;
          updated_by: string | null;
          won_deals: number;
          won_revenue: number;
        };
        Insert: {
          competence?: string;
          conversion_rate?: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          organization_id?: string;
          updated_at?: string;
          updated_by?: string | null;
          won_deals?: number;
          won_revenue?: number;
        };
        Update: {
          competence?: string;
          conversion_rate?: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          organization_id?: string;
          updated_at?: string;
          updated_by?: string | null;
          won_deals?: number;
          won_revenue?: number;
        };
        Relationships: [
          {
            foreignKeyName: "crm_goals_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      crm_lead_events: {
        Row: {
          action: string;
          actor_user_id: string | null;
          created_at: string;
          details: string | null;
          id: string;
          lead_id: string;
          organization_id: string;
        };
        Insert: {
          action: string;
          actor_user_id?: string | null;
          created_at?: string;
          details?: string | null;
          id?: string;
          lead_id: string;
          organization_id?: string;
        };
        Update: {
          action?: string;
          actor_user_id?: string | null;
          created_at?: string;
          details?: string | null;
          id?: string;
          lead_id?: string;
          organization_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "crm_lead_events_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "crm_leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "crm_lead_events_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      crm_leads: {
        Row: {
          competence: string;
          contact: string | null;
          created_at: string;
          created_by: string | null;
          email: string | null;
          estimated_value: number;
          external_id: string | null;
          external_source: string | null;
          id: string;
          name: string;
          notes: string | null;
          organization_id: string;
          phone: string | null;
          source: string | null;
          stage: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          competence: string;
          contact?: string | null;
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          estimated_value?: number;
          external_id?: string | null;
          external_source?: string | null;
          id?: string;
          name: string;
          notes?: string | null;
          organization_id?: string;
          phone?: string | null;
          source?: string | null;
          stage?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          competence?: string;
          contact?: string | null;
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          estimated_value?: number;
          external_id?: string | null;
          external_source?: string | null;
          id?: string;
          name?: string;
          notes?: string | null;
          organization_id?: string;
          phone?: string | null;
          source?: string | null;
          stage?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "crm_leads_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      document_inbox_items: {
        Row: {
          application_status: string;
          archive_path: string | null;
          auto_link_block_reason: string | null;
          blocking_reason: string | null;
          classification_status: string;
          client_id: string | null;
          communication_status: string;
          competence_detected: string | null;
          content_type: string | null;
          created_at: string;
          created_by: string | null;
          detected_client_id: string | null;
          detected_cnpj: string | null;
          document_type_key: string | null;
          execution_notes: string | null;
          execution_status: string;
          extracted_text_preview: string | null;
          file_hash: string | null;
          file_name: string;
          file_size: number | null;
          fingerprint_payload: Json;
          id: string;
          identification_confidence: number;
          ingestion_job_id: string | null;
          last_processing_error: string | null;
          linked_instance_id: string | null;
          match_reasons: Json;
          match_score: number;
          matched_by: string | null;
          notes: string | null;
          ocr_status: string;
          organization_id: string;
          processed_automatically: boolean;
          processing_attempts: number;
          processing_completed_at: string | null;
          processing_started_at: string | null;
          processing_status: string;
          protocol_issued_at: string | null;
          protocol_number: string | null;
          publication_status: string;
          reference_file_id: string | null;
          reference_match_reasons: Json;
          reference_match_score: number;
          review_required: boolean;
          reviewed_at: string | null;
          reviewed_by: string | null;
          robot_machine_id: string | null;
          robot_origin_path: string | null;
          source_kind: string;
          status: string;
          storage_bucket: string;
          storage_path: string;
          suggested_client_id: string | null;
          suggested_competence_label: string | null;
          suggested_instance_id: string | null;
          suggested_template_id: string | null;
          text_extraction_status: string;
          updated_at: string;
        };
        Insert: {
          application_status?: string;
          archive_path?: string | null;
          auto_link_block_reason?: string | null;
          blocking_reason?: string | null;
          classification_status?: string;
          client_id?: string | null;
          communication_status?: string;
          competence_detected?: string | null;
          content_type?: string | null;
          created_at?: string;
          created_by?: string | null;
          detected_client_id?: string | null;
          detected_cnpj?: string | null;
          document_type_key?: string | null;
          execution_notes?: string | null;
          execution_status?: string;
          extracted_text_preview?: string | null;
          file_hash?: string | null;
          file_name: string;
          file_size?: number | null;
          fingerprint_payload?: Json;
          id?: string;
          identification_confidence?: number;
          ingestion_job_id?: string | null;
          last_processing_error?: string | null;
          linked_instance_id?: string | null;
          match_reasons?: Json;
          match_score?: number;
          matched_by?: string | null;
          notes?: string | null;
          ocr_status?: string;
          organization_id?: string;
          processed_automatically?: boolean;
          processing_attempts?: number;
          processing_completed_at?: string | null;
          processing_started_at?: string | null;
          processing_status?: string;
          protocol_issued_at?: string | null;
          protocol_number?: string | null;
          publication_status?: string;
          reference_file_id?: string | null;
          reference_match_reasons?: Json;
          reference_match_score?: number;
          review_required?: boolean;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          robot_machine_id?: string | null;
          robot_origin_path?: string | null;
          source_kind?: string;
          status?: string;
          storage_bucket?: string;
          storage_path: string;
          suggested_client_id?: string | null;
          suggested_competence_label?: string | null;
          suggested_instance_id?: string | null;
          suggested_template_id?: string | null;
          text_extraction_status?: string;
          updated_at?: string;
        };
        Update: {
          application_status?: string;
          archive_path?: string | null;
          auto_link_block_reason?: string | null;
          blocking_reason?: string | null;
          classification_status?: string;
          client_id?: string | null;
          communication_status?: string;
          competence_detected?: string | null;
          content_type?: string | null;
          created_at?: string;
          created_by?: string | null;
          detected_client_id?: string | null;
          detected_cnpj?: string | null;
          document_type_key?: string | null;
          execution_notes?: string | null;
          execution_status?: string;
          extracted_text_preview?: string | null;
          file_hash?: string | null;
          file_name?: string;
          file_size?: number | null;
          fingerprint_payload?: Json;
          id?: string;
          identification_confidence?: number;
          ingestion_job_id?: string | null;
          last_processing_error?: string | null;
          linked_instance_id?: string | null;
          match_reasons?: Json;
          match_score?: number;
          matched_by?: string | null;
          notes?: string | null;
          ocr_status?: string;
          organization_id?: string;
          processed_automatically?: boolean;
          processing_attempts?: number;
          processing_completed_at?: string | null;
          processing_started_at?: string | null;
          processing_status?: string;
          protocol_issued_at?: string | null;
          protocol_number?: string | null;
          publication_status?: string;
          reference_file_id?: string | null;
          reference_match_reasons?: Json;
          reference_match_score?: number;
          review_required?: boolean;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          robot_machine_id?: string | null;
          robot_origin_path?: string | null;
          source_kind?: string;
          status?: string;
          storage_bucket?: string;
          storage_path?: string;
          suggested_client_id?: string | null;
          suggested_competence_label?: string | null;
          suggested_instance_id?: string | null;
          suggested_template_id?: string | null;
          text_extraction_status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "document_inbox_items_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "acessorias_report_overview";
            referencedColumns: ["client_id"];
          },
          {
            foreignKeyName: "document_inbox_items_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "document_inbox_items_detected_client_id_fkey";
            columns: ["detected_client_id"];
            isOneToOne: false;
            referencedRelation: "acessorias_report_overview";
            referencedColumns: ["client_id"];
          },
          {
            foreignKeyName: "document_inbox_items_detected_client_id_fkey";
            columns: ["detected_client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "document_inbox_items_ingestion_job_id_fkey";
            columns: ["ingestion_job_id"];
            isOneToOne: false;
            referencedRelation: "document_ingestion_jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "document_inbox_items_linked_instance_id_fkey";
            columns: ["linked_instance_id"];
            isOneToOne: false;
            referencedRelation: "obligation_instances";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "document_inbox_items_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "document_inbox_items_reference_file_id_fkey";
            columns: ["reference_file_id"];
            isOneToOne: false;
            referencedRelation: "expected_document_reference_files";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "document_inbox_items_suggested_client_id_fkey";
            columns: ["suggested_client_id"];
            isOneToOne: false;
            referencedRelation: "acessorias_report_overview";
            referencedColumns: ["client_id"];
          },
          {
            foreignKeyName: "document_inbox_items_suggested_client_id_fkey";
            columns: ["suggested_client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "document_inbox_items_suggested_instance_id_fkey";
            columns: ["suggested_instance_id"];
            isOneToOne: false;
            referencedRelation: "obligation_instances";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "document_inbox_items_suggested_template_id_fkey";
            columns: ["suggested_template_id"];
            isOneToOne: false;
            referencedRelation: "obligation_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      document_ingestion_jobs: {
        Row: {
          application_status: string;
          attempts: number;
          classification_status: string;
          client_id: string | null;
          communication_status: string;
          completed_at: string | null;
          created_at: string;
          created_by: string | null;
          detected_client_id: string | null;
          file_hash: string | null;
          file_name: string;
          file_size: number | null;
          id: string;
          inbox_item_id: string | null;
          instance_id: string | null;
          last_error: string | null;
          metadata: Json;
          organization_id: string;
          protocol_issued_at: string | null;
          protocol_number: string | null;
          publication_status: string;
          review_required: boolean;
          robot_machine_id: string | null;
          robot_origin_path: string | null;
          source_kind: string;
          started_at: string | null;
          status: string;
          storage_bucket: string;
          storage_path: string;
          template_id: string | null;
          updated_at: string;
        };
        Insert: {
          application_status?: string;
          attempts?: number;
          classification_status?: string;
          client_id?: string | null;
          communication_status?: string;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          detected_client_id?: string | null;
          file_hash?: string | null;
          file_name: string;
          file_size?: number | null;
          id?: string;
          inbox_item_id?: string | null;
          instance_id?: string | null;
          last_error?: string | null;
          metadata?: Json;
          organization_id?: string;
          protocol_issued_at?: string | null;
          protocol_number?: string | null;
          publication_status?: string;
          review_required?: boolean;
          robot_machine_id?: string | null;
          robot_origin_path?: string | null;
          source_kind?: string;
          started_at?: string | null;
          status?: string;
          storage_bucket?: string;
          storage_path: string;
          template_id?: string | null;
          updated_at?: string;
        };
        Update: {
          application_status?: string;
          attempts?: number;
          classification_status?: string;
          client_id?: string | null;
          communication_status?: string;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          detected_client_id?: string | null;
          file_hash?: string | null;
          file_name?: string;
          file_size?: number | null;
          id?: string;
          inbox_item_id?: string | null;
          instance_id?: string | null;
          last_error?: string | null;
          metadata?: Json;
          organization_id?: string;
          protocol_issued_at?: string | null;
          protocol_number?: string | null;
          publication_status?: string;
          review_required?: boolean;
          robot_machine_id?: string | null;
          robot_origin_path?: string | null;
          source_kind?: string;
          started_at?: string | null;
          status?: string;
          storage_bucket?: string;
          storage_path?: string;
          template_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "document_ingestion_jobs_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "acessorias_report_overview";
            referencedColumns: ["client_id"];
          },
          {
            foreignKeyName: "document_ingestion_jobs_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "document_ingestion_jobs_detected_client_id_fkey";
            columns: ["detected_client_id"];
            isOneToOne: false;
            referencedRelation: "acessorias_report_overview";
            referencedColumns: ["client_id"];
          },
          {
            foreignKeyName: "document_ingestion_jobs_detected_client_id_fkey";
            columns: ["detected_client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "document_ingestion_jobs_inbox_item_id_fkey";
            columns: ["inbox_item_id"];
            isOneToOne: false;
            referencedRelation: "document_inbox_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "document_ingestion_jobs_instance_id_fkey";
            columns: ["instance_id"];
            isOneToOne: false;
            referencedRelation: "obligation_instances";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "document_ingestion_jobs_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "document_ingestion_jobs_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "obligation_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      email_inbox_messages: {
        Row: {
          created_at: string;
          from_email: string;
          html_content: string | null;
          id: string;
          organization_id: string;
          preview: string | null;
          provider: string;
          provider_message_id: string | null;
          read_at: string | null;
          received_at: string;
          source_payload: Json | null;
          subject: string;
          text_content: string | null;
          to_email: string;
        };
        Insert: {
          created_at?: string;
          from_email: string;
          html_content?: string | null;
          id?: string;
          organization_id?: string;
          preview?: string | null;
          provider?: string;
          provider_message_id?: string | null;
          read_at?: string | null;
          received_at?: string;
          source_payload?: Json | null;
          subject?: string;
          text_content?: string | null;
          to_email: string;
        };
        Update: {
          created_at?: string;
          from_email?: string;
          html_content?: string | null;
          id?: string;
          organization_id?: string;
          preview?: string | null;
          provider?: string;
          provider_message_id?: string | null;
          read_at?: string | null;
          received_at?: string;
          source_payload?: Json | null;
          subject?: string;
          text_content?: string | null;
          to_email?: string;
        };
        Relationships: [
          {
            foreignKeyName: "email_inbox_messages_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      expected_document_reference_files: {
        Row: {
          content_type: string | null;
          created_at: string;
          created_by: string | null;
          document_type_key: string;
          extracted_text: string | null;
          extracted_text_preview: string | null;
          file_name: string;
          file_size: number | null;
          fingerprint_payload: Json;
          fingerprint_version: number;
          id: string;
          is_active: boolean;
          keywords: Json;
          ocr_status: string;
          organization_id: string;
          primary_cues: Json;
          profile_id: string | null;
          source_kind: string;
          storage_bucket: string;
          storage_path: string;
          template_id: string;
          text_extraction_status: string;
          updated_at: string;
        };
        Insert: {
          content_type?: string | null;
          created_at?: string;
          created_by?: string | null;
          document_type_key: string;
          extracted_text?: string | null;
          extracted_text_preview?: string | null;
          file_name: string;
          file_size?: number | null;
          fingerprint_payload?: Json;
          fingerprint_version?: number;
          id?: string;
          is_active?: boolean;
          keywords?: Json;
          ocr_status?: string;
          organization_id?: string;
          primary_cues?: Json;
          profile_id?: string | null;
          source_kind?: string;
          storage_bucket?: string;
          storage_path: string;
          template_id: string;
          text_extraction_status?: string;
          updated_at?: string;
        };
        Update: {
          content_type?: string | null;
          created_at?: string;
          created_by?: string | null;
          document_type_key?: string;
          extracted_text?: string | null;
          extracted_text_preview?: string | null;
          file_name?: string;
          file_size?: number | null;
          fingerprint_payload?: Json;
          fingerprint_version?: number;
          id?: string;
          is_active?: boolean;
          keywords?: Json;
          ocr_status?: string;
          organization_id?: string;
          primary_cues?: Json;
          profile_id?: string | null;
          source_kind?: string;
          storage_bucket?: string;
          storage_path?: string;
          template_id?: string;
          text_extraction_status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "expected_document_reference_files_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expected_document_reference_files_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "client_obligation_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expected_document_reference_files_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "obligation_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      form_submissions: {
        Row: {
          client_id: string | null;
          created_at: string;
          data: Json | null;
          id: string;
          notes: string | null;
          organization_id: string;
          request_id: string | null;
          status: string | null;
          submitted_by: string | null;
          submitted_by_name: string | null;
          template_id: string | null;
          template_title: string;
          updated_at: string;
        };
        Insert: {
          client_id?: string | null;
          created_at?: string;
          data?: Json | null;
          id?: string;
          notes?: string | null;
          organization_id?: string;
          request_id?: string | null;
          status?: string | null;
          submitted_by?: string | null;
          submitted_by_name?: string | null;
          template_id?: string | null;
          template_title: string;
          updated_at?: string;
        };
        Update: {
          client_id?: string | null;
          created_at?: string;
          data?: Json | null;
          id?: string;
          notes?: string | null;
          organization_id?: string;
          request_id?: string | null;
          status?: string | null;
          submitted_by?: string | null;
          submitted_by_name?: string | null;
          template_id?: string | null;
          template_title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "form_submissions_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "acessorias_report_overview";
            referencedColumns: ["client_id"];
          },
          {
            foreignKeyName: "form_submissions_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "form_submissions_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "form_submissions_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "client_requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "form_submissions_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "form_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      form_templates: {
        Row: {
          created_at: string;
          created_by: string | null;
          description: string | null;
          fields: Json;
          id: string;
          is_published: boolean;
          organization_id: string;
          sector: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          fields?: Json;
          id?: string;
          is_published?: boolean;
          organization_id?: string;
          sector?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          fields?: Json;
          id?: string;
          is_published?: boolean;
          organization_id?: string;
          sector?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "form_templates_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      integration_api_credentials: {
        Row: {
          created_at: string;
          created_by: string | null;
          enabled: boolean;
          id: string;
          last_used_at: string | null;
          organization_id: string;
          revoked_at: string | null;
          token_hash: string;
          token_prefix: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          enabled?: boolean;
          id?: string;
          last_used_at?: string | null;
          organization_id?: string;
          revoked_at?: string | null;
          token_hash: string;
          token_prefix?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          enabled?: boolean;
          id?: string;
          last_used_at?: string | null;
          organization_id?: string;
          revoked_at?: string | null;
          token_hash?: string;
          token_prefix?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "integration_api_credentials_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      internal_chat_messages: {
        Row: {
          chat_type: string;
          client_message_id: string | null;
          content: string;
          created_at: string;
          id: string;
          organization_id: string;
          recipient_user_id: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          chat_type?: string;
          client_message_id?: string | null;
          content: string;
          created_at?: string;
          id?: string;
          organization_id?: string;
          recipient_user_id?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          chat_type?: string;
          client_message_id?: string | null;
          content?: string;
          created_at?: string;
          id?: string;
          organization_id?: string;
          recipient_user_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "internal_chat_messages_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      kanban_task_comments: {
        Row: {
          content: string;
          created_at: string;
          id: string;
          organization_id: string;
          task_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          content: string;
          created_at?: string;
          id?: string;
          organization_id?: string;
          task_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          id?: string;
          organization_id?: string;
          task_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "kanban_task_comments_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "kanban_task_comments_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "kanban_tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      kanban_tasks: {
        Row: {
          assigned_to_user_id: string | null;
          assignee: string | null;
          client_name: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          due_date: string | null;
          id: string;
          integration_payload: Json | null;
          integration_source: string | null;
          integration_task_id: string | null;
          organization_id: string;
          priority: string;
          request_id: string | null;
          sector: string;
          status: string;
          subtasks: Json;
          tags: string[] | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          assigned_to_user_id?: string | null;
          assignee?: string | null;
          client_name?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          integration_payload?: Json | null;
          integration_source?: string | null;
          integration_task_id?: string | null;
          organization_id?: string;
          priority?: string;
          request_id?: string | null;
          sector?: string;
          status?: string;
          subtasks?: Json;
          tags?: string[] | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          assigned_to_user_id?: string | null;
          assignee?: string | null;
          client_name?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          integration_payload?: Json | null;
          integration_source?: string | null;
          integration_task_id?: string | null;
          organization_id?: string;
          priority?: string;
          request_id?: string | null;
          sector?: string;
          status?: string;
          subtasks?: Json;
          tags?: string[] | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "kanban_tasks_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "kanban_tasks_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "client_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      manual_user_progress: {
        Row: {
          completed_at: string | null;
          context_key: string;
          created_at: string;
          id: string;
          lesson_key: string;
          module_key: string;
          organization_id: string;
          started_at: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          completed_at?: string | null;
          context_key: string;
          created_at?: string;
          id?: string;
          lesson_key: string;
          module_key: string;
          organization_id?: string;
          started_at?: string;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          completed_at?: string | null;
          context_key?: string;
          created_at?: string;
          id?: string;
          lesson_key?: string;
          module_key?: string;
          organization_id?: string;
          started_at?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "manual_user_progress_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      manual_user_state: {
        Row: {
          created_at: string;
          id: string;
          last_context_key: string | null;
          last_module_key: string | null;
          onboarding_dismissed_at: string | null;
          organization_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          last_context_key?: string | null;
          last_module_key?: string | null;
          onboarding_dismissed_at?: string | null;
          organization_id?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          last_context_key?: string | null;
          last_module_key?: string | null;
          onboarding_dismissed_at?: string | null;
          organization_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "manual_user_state_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      newsletter_subscribers: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          organization_id: string;
          source: string | null;
          status: string;
          subscribed_at: string;
          unsubscribed_at: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          organization_id?: string;
          source?: string | null;
          status?: string;
          subscribed_at?: string;
          unsubscribed_at?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          organization_id?: string;
          source?: string | null;
          status?: string;
          subscribed_at?: string;
          unsubscribed_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "newsletter_subscribers_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      newsletters: {
        Row: {
          content: string;
          created_at: string;
          created_by: string | null;
          email_send_error: string | null;
          email_sent_at: string | null;
          excerpt: string | null;
          id: string;
          is_published: boolean;
          organization_id: string;
          published_at: string | null;
          slug: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          content: string;
          created_at?: string;
          created_by?: string | null;
          email_send_error?: string | null;
          email_sent_at?: string | null;
          excerpt?: string | null;
          id?: string;
          is_published?: boolean;
          organization_id?: string;
          published_at?: string | null;
          slug: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          created_by?: string | null;
          email_send_error?: string | null;
          email_sent_at?: string | null;
          excerpt?: string | null;
          id?: string;
          is_published?: boolean;
          organization_id?: string;
          published_at?: string | null;
          slug?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "newsletters_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      obligation_audit_events: {
        Row: {
          action: string;
          actor_id: string | null;
          client_id: string | null;
          created_at: string;
          entity_id: string | null;
          entity_type: string;
          id: string;
          metadata: Json;
          organization_id: string;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          client_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type: string;
          id?: string;
          metadata?: Json;
          organization_id?: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          client_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string;
          id?: string;
          metadata?: Json;
          organization_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "obligation_audit_events_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "acessorias_report_overview";
            referencedColumns: ["client_id"];
          },
          {
            foreignKeyName: "obligation_audit_events_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obligation_audit_events_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      obligation_instance_events: {
        Row: {
          comment: string | null;
          created_at: string;
          created_by: string | null;
          event_type: string;
          from_status: string | null;
          id: string;
          instance_id: string;
          metadata: Json;
          organization_id: string;
          to_status: string | null;
        };
        Insert: {
          comment?: string | null;
          created_at?: string;
          created_by?: string | null;
          event_type?: string;
          from_status?: string | null;
          id?: string;
          instance_id: string;
          metadata?: Json;
          organization_id?: string;
          to_status?: string | null;
        };
        Update: {
          comment?: string | null;
          created_at?: string;
          created_by?: string | null;
          event_type?: string;
          from_status?: string | null;
          id?: string;
          instance_id?: string;
          metadata?: Json;
          organization_id?: string;
          to_status?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "obligation_instance_events_instance_id_fkey";
            columns: ["instance_id"];
            isOneToOne: false;
            referencedRelation: "obligation_instances";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obligation_instance_events_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      obligation_instance_files: {
        Row: {
          content_type: string | null;
          created_at: string;
          file_name: string;
          file_size: number | null;
          id: string;
          identification_confidence: number;
          inbox_item_id: string | null;
          instance_id: string;
          organization_id: string;
          protocol_number: string | null;
          publication_status: string;
          source: string;
          source_kind: string;
          storage_bucket: string;
          storage_path: string;
          triage_status: string;
          uploaded_by: string | null;
        };
        Insert: {
          content_type?: string | null;
          created_at?: string;
          file_name: string;
          file_size?: number | null;
          id?: string;
          identification_confidence?: number;
          inbox_item_id?: string | null;
          instance_id: string;
          organization_id?: string;
          protocol_number?: string | null;
          publication_status?: string;
          source?: string;
          source_kind?: string;
          storage_bucket?: string;
          storage_path: string;
          triage_status?: string;
          uploaded_by?: string | null;
        };
        Update: {
          content_type?: string | null;
          created_at?: string;
          file_name?: string;
          file_size?: number | null;
          id?: string;
          identification_confidence?: number;
          inbox_item_id?: string | null;
          instance_id?: string;
          organization_id?: string;
          protocol_number?: string | null;
          publication_status?: string;
          source?: string;
          source_kind?: string;
          storage_bucket?: string;
          storage_path?: string;
          triage_status?: string;
          uploaded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "obligation_instance_files_inbox_item_id_fkey";
            columns: ["inbox_item_id"];
            isOneToOne: false;
            referencedRelation: "document_inbox_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obligation_instance_files_instance_id_fkey";
            columns: ["instance_id"];
            isOneToOne: false;
            referencedRelation: "obligation_instances";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obligation_instance_files_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      obligation_instances: {
        Row: {
          client_id: string;
          competence_date: string;
          competence_key: string;
          competence_label: string;
          completed_at: string | null;
          completed_by_inbox_item_id: string | null;
          completion_notes: string | null;
          created_at: string;
          created_by: string | null;
          current_assignee: string | null;
          document_required: boolean;
          id: string;
          last_status_at: string;
          legal_due_date: string | null;
          organization_id: string;
          origin: string;
          priority: string;
          processed_automatically: boolean;
          profile_id: string;
          protocol: string | null;
          protocol_issued_at: string | null;
          status: string;
          technical_due_date: string;
          template_id: string;
          updated_at: string;
        };
        Insert: {
          client_id: string;
          competence_date: string;
          competence_key: string;
          competence_label: string;
          completed_at?: string | null;
          completed_by_inbox_item_id?: string | null;
          completion_notes?: string | null;
          created_at?: string;
          created_by?: string | null;
          current_assignee?: string | null;
          document_required?: boolean;
          id?: string;
          last_status_at?: string;
          legal_due_date?: string | null;
          organization_id?: string;
          origin?: string;
          priority?: string;
          processed_automatically?: boolean;
          profile_id: string;
          protocol?: string | null;
          protocol_issued_at?: string | null;
          status?: string;
          technical_due_date: string;
          template_id: string;
          updated_at?: string;
        };
        Update: {
          client_id?: string;
          competence_date?: string;
          competence_key?: string;
          competence_label?: string;
          completed_at?: string | null;
          completed_by_inbox_item_id?: string | null;
          completion_notes?: string | null;
          created_at?: string;
          created_by?: string | null;
          current_assignee?: string | null;
          document_required?: boolean;
          id?: string;
          last_status_at?: string;
          legal_due_date?: string | null;
          organization_id?: string;
          origin?: string;
          priority?: string;
          processed_automatically?: boolean;
          profile_id?: string;
          protocol?: string | null;
          protocol_issued_at?: string | null;
          status?: string;
          technical_due_date?: string;
          template_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "obligation_instances_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "acessorias_report_overview";
            referencedColumns: ["client_id"];
          },
          {
            foreignKeyName: "obligation_instances_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obligation_instances_completed_by_inbox_item_id_fkey";
            columns: ["completed_by_inbox_item_id"];
            isOneToOne: false;
            referencedRelation: "document_inbox_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obligation_instances_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obligation_instances_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "client_obligation_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obligation_instances_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "obligation_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      obligation_load_application_batches: {
        Row: {
          applied_at: string | null;
          applied_by: string | null;
          client_id: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          load_id: string | null;
          mode: string;
          organization_id: string;
          status: string;
          summary: Json;
          sync_scope: string;
          tax_regime_code: string;
          warnings: Json;
        };
        Insert: {
          applied_at?: string | null;
          applied_by?: string | null;
          client_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          load_id?: string | null;
          mode: string;
          organization_id?: string;
          status?: string;
          summary?: Json;
          sync_scope?: string;
          tax_regime_code: string;
          warnings?: Json;
        };
        Update: {
          applied_at?: string | null;
          applied_by?: string | null;
          client_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          load_id?: string | null;
          mode?: string;
          organization_id?: string;
          status?: string;
          summary?: Json;
          sync_scope?: string;
          tax_regime_code?: string;
          warnings?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "obligation_load_application_batches_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "acessorias_report_overview";
            referencedColumns: ["client_id"];
          },
          {
            foreignKeyName: "obligation_load_application_batches_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obligation_load_application_batches_load_id_fkey";
            columns: ["load_id"];
            isOneToOne: false;
            referencedRelation: "obligation_regime_loads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obligation_load_application_batches_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      obligation_load_application_reviews: {
        Row: {
          auto_applied: boolean;
          batch_id: string;
          client_id: string | null;
          created_at: string;
          current_profile_id: string | null;
          decision_type: string;
          evidence_source: string | null;
          id: string;
          load_item_id: string | null;
          organization_id: string;
          reason: string;
          requires_confirmation: boolean;
          selected: boolean;
          sync_effect: string;
          template_id: string | null;
        };
        Insert: {
          auto_applied?: boolean;
          batch_id: string;
          client_id?: string | null;
          created_at?: string;
          current_profile_id?: string | null;
          decision_type: string;
          evidence_source?: string | null;
          id?: string;
          load_item_id?: string | null;
          organization_id?: string;
          reason: string;
          requires_confirmation?: boolean;
          selected?: boolean;
          sync_effect?: string;
          template_id?: string | null;
        };
        Update: {
          auto_applied?: boolean;
          batch_id?: string;
          client_id?: string | null;
          created_at?: string;
          current_profile_id?: string | null;
          decision_type?: string;
          evidence_source?: string | null;
          id?: string;
          load_item_id?: string | null;
          organization_id?: string;
          reason?: string;
          requires_confirmation?: boolean;
          selected?: boolean;
          sync_effect?: string;
          template_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "obligation_load_application_reviews_batch_id_fkey";
            columns: ["batch_id"];
            isOneToOne: false;
            referencedRelation: "obligation_load_application_batches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obligation_load_application_reviews_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "acessorias_report_overview";
            referencedColumns: ["client_id"];
          },
          {
            foreignKeyName: "obligation_load_application_reviews_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obligation_load_application_reviews_current_profile_id_fkey";
            columns: ["current_profile_id"];
            isOneToOne: false;
            referencedRelation: "client_obligation_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obligation_load_application_reviews_load_item_id_fkey";
            columns: ["load_item_id"];
            isOneToOne: false;
            referencedRelation: "obligation_regime_load_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obligation_load_application_reviews_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obligation_load_application_reviews_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "obligation_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      obligation_load_sync_runs: {
        Row: {
          clients_processed: number;
          clients_total: number;
          completed_at: string | null;
          id: string;
          load_id: string;
          organization_id: string;
          profiles_created: number;
          profiles_inactivated_future: number;
          profiles_reactivated: number;
          profiles_skipped: number;
          review_required: number;
          scope: string;
          started_at: string;
          started_by: string | null;
          status: string;
          tax_regime_code: string;
          warnings: Json;
        };
        Insert: {
          clients_processed?: number;
          clients_total?: number;
          completed_at?: string | null;
          id?: string;
          load_id: string;
          organization_id?: string;
          profiles_created?: number;
          profiles_inactivated_future?: number;
          profiles_reactivated?: number;
          profiles_skipped?: number;
          review_required?: number;
          scope?: string;
          started_at?: string;
          started_by?: string | null;
          status?: string;
          tax_regime_code: string;
          warnings?: Json;
        };
        Update: {
          clients_processed?: number;
          clients_total?: number;
          completed_at?: string | null;
          id?: string;
          load_id?: string;
          organization_id?: string;
          profiles_created?: number;
          profiles_inactivated_future?: number;
          profiles_reactivated?: number;
          profiles_skipped?: number;
          review_required?: number;
          scope?: string;
          started_at?: string;
          started_by?: string | null;
          status?: string;
          tax_regime_code?: string;
          warnings?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "obligation_load_sync_runs_load_id_fkey";
            columns: ["load_id"];
            isOneToOne: false;
            referencedRelation: "obligation_regime_loads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obligation_load_sync_runs_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      obligation_regime_load_items: {
        Row: {
          applicability: string;
          condition_key: string | null;
          created_at: string;
          created_by: string | null;
          default_due_day_override: number | null;
          default_start_policy: string;
          id: string;
          is_active: boolean;
          load_id: string;
          notes: string | null;
          organization_id: string;
          sort_order: number;
          template_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          applicability?: string;
          condition_key?: string | null;
          created_at?: string;
          created_by?: string | null;
          default_due_day_override?: number | null;
          default_start_policy?: string;
          id?: string;
          is_active?: boolean;
          load_id: string;
          notes?: string | null;
          organization_id?: string;
          sort_order?: number;
          template_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          applicability?: string;
          condition_key?: string | null;
          created_at?: string;
          created_by?: string | null;
          default_due_day_override?: number | null;
          default_start_policy?: string;
          id?: string;
          is_active?: boolean;
          load_id?: string;
          notes?: string | null;
          organization_id?: string;
          sort_order?: number;
          template_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "obligation_regime_load_items_load_id_fkey";
            columns: ["load_id"];
            isOneToOne: false;
            referencedRelation: "obligation_regime_loads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obligation_regime_load_items_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obligation_regime_load_items_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "obligation_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      obligation_regime_loads: {
        Row: {
          created_at: string;
          created_by: string | null;
          description: string | null;
          effective_from: string;
          effective_until: string | null;
          id: string;
          name: string;
          organization_id: string;
          owner_sector: string | null;
          review_notes: string | null;
          status: string;
          tax_regime_code: string;
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          effective_from?: string;
          effective_until?: string | null;
          id?: string;
          name: string;
          organization_id?: string;
          owner_sector?: string | null;
          review_notes?: string | null;
          status?: string;
          tax_regime_code: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          effective_from?: string;
          effective_until?: string | null;
          id?: string;
          name?: string;
          organization_id?: string;
          owner_sector?: string | null;
          review_notes?: string | null;
          status?: string;
          tax_regime_code?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "obligation_regime_loads_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      obligation_templates: {
        Row: {
          baseline_source: string;
          catalog_review_status: string;
          code: string;
          competence_reference: string;
          completion_email_body: string | null;
          completion_email_enabled: boolean;
          completion_email_subject: string | null;
          completion_whatsapp_body: string | null;
          completion_whatsapp_enabled: boolean;
          created_at: string;
          created_by: string | null;
          due_day: number;
          duplicate_group_key: string | null;
          expected_documents: Json;
          generates_calendar: boolean;
          generates_kanban: boolean;
          id: string;
          is_active: boolean;
          legal_due_day: number | null;
          name: string;
          normalized_name: string | null;
          operational_notes: string | null;
          organization_id: string;
          periodicity: string;
          priority: string;
          requires_document: boolean;
          sector: string;
          technical_due_month_reference: string;
          updated_at: string;
          yearly_due_month: number | null;
        };
        Insert: {
          baseline_source?: string;
          catalog_review_status?: string;
          code: string;
          competence_reference?: string;
          completion_email_body?: string | null;
          completion_email_enabled?: boolean;
          completion_email_subject?: string | null;
          completion_whatsapp_body?: string | null;
          completion_whatsapp_enabled?: boolean;
          created_at?: string;
          created_by?: string | null;
          due_day?: number;
          duplicate_group_key?: string | null;
          expected_documents?: Json;
          generates_calendar?: boolean;
          generates_kanban?: boolean;
          id?: string;
          is_active?: boolean;
          legal_due_day?: number | null;
          name: string;
          normalized_name?: string | null;
          operational_notes?: string | null;
          organization_id?: string;
          periodicity?: string;
          priority?: string;
          requires_document?: boolean;
          sector?: string;
          technical_due_month_reference?: string;
          updated_at?: string;
          yearly_due_month?: number | null;
        };
        Update: {
          baseline_source?: string;
          catalog_review_status?: string;
          code?: string;
          competence_reference?: string;
          completion_email_body?: string | null;
          completion_email_enabled?: boolean;
          completion_email_subject?: string | null;
          completion_whatsapp_body?: string | null;
          completion_whatsapp_enabled?: boolean;
          created_at?: string;
          created_by?: string | null;
          due_day?: number;
          duplicate_group_key?: string | null;
          expected_documents?: Json;
          generates_calendar?: boolean;
          generates_kanban?: boolean;
          id?: string;
          is_active?: boolean;
          legal_due_day?: number | null;
          name?: string;
          normalized_name?: string | null;
          operational_notes?: string | null;
          organization_id?: string;
          periodicity?: string;
          priority?: string;
          requires_document?: boolean;
          sector?: string;
          technical_due_month_reference?: string;
          updated_at?: string;
          yearly_due_month?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "obligation_templates_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      open_finance_accounts: {
        Row: {
          account_mask: string | null;
          account_name: string | null;
          account_type: string | null;
          client_id: string;
          connection_id: string;
          created_at: string;
          currency_code: string;
          external_account_id: string;
          id: string;
          institution_name: string | null;
          is_active: boolean;
          organization_id: string;
          updated_at: string;
        };
        Insert: {
          account_mask?: string | null;
          account_name?: string | null;
          account_type?: string | null;
          client_id: string;
          connection_id: string;
          created_at?: string;
          currency_code?: string;
          external_account_id: string;
          id?: string;
          institution_name?: string | null;
          is_active?: boolean;
          organization_id?: string;
          updated_at?: string;
        };
        Update: {
          account_mask?: string | null;
          account_name?: string | null;
          account_type?: string | null;
          client_id?: string;
          connection_id?: string;
          created_at?: string;
          currency_code?: string;
          external_account_id?: string;
          id?: string;
          institution_name?: string | null;
          is_active?: boolean;
          organization_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "open_finance_accounts_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "acessorias_report_overview";
            referencedColumns: ["client_id"];
          },
          {
            foreignKeyName: "open_finance_accounts_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "open_finance_accounts_connection_id_fkey";
            columns: ["connection_id"];
            isOneToOne: false;
            referencedRelation: "open_finance_connections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "open_finance_accounts_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      open_finance_connections: {
        Row: {
          client_id: string;
          consent_expires_at: string | null;
          consent_status: string;
          created_at: string;
          created_by: string | null;
          disconnected_at: string | null;
          external_item_id: string;
          external_user_ref: string | null;
          id: string;
          last_sync_error: string | null;
          last_synced_at: string | null;
          organization_id: string;
          provider: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          client_id: string;
          consent_expires_at?: string | null;
          consent_status?: string;
          created_at?: string;
          created_by?: string | null;
          disconnected_at?: string | null;
          external_item_id: string;
          external_user_ref?: string | null;
          id?: string;
          last_sync_error?: string | null;
          last_synced_at?: string | null;
          organization_id?: string;
          provider: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          client_id?: string;
          consent_expires_at?: string | null;
          consent_status?: string;
          created_at?: string;
          created_by?: string | null;
          disconnected_at?: string | null;
          external_item_id?: string;
          external_user_ref?: string | null;
          id?: string;
          last_sync_error?: string | null;
          last_synced_at?: string | null;
          organization_id?: string;
          provider?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "open_finance_connections_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "acessorias_report_overview";
            referencedColumns: ["client_id"];
          },
          {
            foreignKeyName: "open_finance_connections_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "open_finance_connections_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      open_finance_transactions: {
        Row: {
          account_id: string | null;
          amount: number;
          category: string | null;
          client_id: string;
          connection_id: string;
          created_at: string;
          description: string;
          direction: string;
          external_transaction_id: string;
          id: string;
          imported_to_cashflow_at: string | null;
          occurred_at: string;
          organization_id: string;
          provider_payload_min: Json | null;
          updated_at: string;
        };
        Insert: {
          account_id?: string | null;
          amount: number;
          category?: string | null;
          client_id: string;
          connection_id: string;
          created_at?: string;
          description: string;
          direction: string;
          external_transaction_id: string;
          id?: string;
          imported_to_cashflow_at?: string | null;
          occurred_at: string;
          organization_id?: string;
          provider_payload_min?: Json | null;
          updated_at?: string;
        };
        Update: {
          account_id?: string | null;
          amount?: number;
          category?: string | null;
          client_id?: string;
          connection_id?: string;
          created_at?: string;
          description?: string;
          direction?: string;
          external_transaction_id?: string;
          id?: string;
          imported_to_cashflow_at?: string | null;
          occurred_at?: string;
          organization_id?: string;
          provider_payload_min?: Json | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "open_finance_transactions_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "open_finance_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "open_finance_transactions_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "acessorias_report_overview";
            referencedColumns: ["client_id"];
          },
          {
            foreignKeyName: "open_finance_transactions_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "open_finance_transactions_connection_id_fkey";
            columns: ["connection_id"];
            isOneToOne: false;
            referencedRelation: "open_finance_connections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "open_finance_transactions_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      open_finance_webhook_events: {
        Row: {
          attempt_count: number;
          created_at: string;
          event_id: string;
          event_type: string | null;
          id: string;
          last_error: string | null;
          organization_id: string;
          payload_min: Json | null;
          processed_at: string | null;
          processing_status: string;
          provider: string;
          received_at: string;
        };
        Insert: {
          attempt_count?: number;
          created_at?: string;
          event_id: string;
          event_type?: string | null;
          id?: string;
          last_error?: string | null;
          organization_id?: string;
          payload_min?: Json | null;
          processed_at?: string | null;
          processing_status?: string;
          provider: string;
          received_at?: string;
        };
        Update: {
          attempt_count?: number;
          created_at?: string;
          event_id?: string;
          event_type?: string | null;
          id?: string;
          last_error?: string | null;
          organization_id?: string;
          payload_min?: Json | null;
          processed_at?: string | null;
          processing_status?: string;
          provider?: string;
          received_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "open_finance_webhook_events_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      operational_audit_logs: {
        Row: {
          action: string;
          actor_user_id: string | null;
          client_id: string | null;
          created_at: string;
          entity_id: string | null;
          entity_type: string | null;
          id: string;
          metadata: Json;
          organization_id: string;
          request_id: string | null;
          result: string;
        };
        Insert: {
          action: string;
          actor_user_id?: string | null;
          client_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
          metadata?: Json;
          organization_id: string;
          request_id?: string | null;
          result?: string;
        };
        Update: {
          action?: string;
          actor_user_id?: string | null;
          client_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
          metadata?: Json;
          organization_id?: string;
          request_id?: string | null;
          result?: string;
        };
        Relationships: [
          {
            foreignKeyName: "operational_audit_logs_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "acessorias_report_overview";
            referencedColumns: ["client_id"];
          },
          {
            foreignKeyName: "operational_audit_logs_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "operational_audit_logs_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      organization_settings: {
        Row: {
          created_at: string;
          display_name: string;
          domain: string | null;
          feature_flags: Json;
          id: string;
          notification_settings: Json;
          operational_limits: Json;
          organization_id: string;
          primary_email: string | null;
          primary_phone: string | null;
          public_keys: Json;
          updated_at: string;
          whatsapp_phone: string | null;
        };
        Insert: {
          created_at?: string;
          display_name?: string;
          domain?: string | null;
          feature_flags?: Json;
          id?: string;
          notification_settings?: Json;
          operational_limits?: Json;
          organization_id: string;
          primary_email?: string | null;
          primary_phone?: string | null;
          public_keys?: Json;
          updated_at?: string;
          whatsapp_phone?: string | null;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          domain?: string | null;
          feature_flags?: Json;
          id?: string;
          notification_settings?: Json;
          operational_limits?: Json;
          organization_id?: string;
          primary_email?: string | null;
          primary_phone?: string | null;
          public_keys?: Json;
          updated_at?: string;
          whatsapp_phone?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "organization_settings_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: true;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      organization_user_access: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          organization_id: string;
          primary_role: string;
          requires_access_review: boolean;
          sector_code: string | null;
          status: string;
          updated_at: string;
          updated_by: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          organization_id: string;
          primary_role: string;
          requires_access_review?: boolean;
          sector_code?: string | null;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          organization_id?: string;
          primary_role?: string;
          requires_access_review?: boolean;
          sector_code?: string | null;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_user_access_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          created_at: string;
          domain: string | null;
          id: string;
          is_active: boolean;
          legal_name: string | null;
          name: string;
          primary_email: string | null;
          primary_phone: string | null;
          slug: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          domain?: string | null;
          id?: string;
          is_active?: boolean;
          legal_name?: string | null;
          name: string;
          primary_email?: string | null;
          primary_phone?: string | null;
          slug: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          domain?: string | null;
          id?: string;
          is_active?: boolean;
          legal_name?: string | null;
          name?: string;
          primary_email?: string | null;
          primary_phone?: string | null;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      permission_audit_entries: {
        Row: {
          action: string;
          actor_user_id: string | null;
          created_at: string;
          id: string;
          new_value: Json | null;
          organization_id: string;
          previous_value: Json | null;
          reason: string | null;
          result: string;
          target_user_id: string;
        };
        Insert: {
          action: string;
          actor_user_id?: string | null;
          created_at?: string;
          id?: string;
          new_value?: Json | null;
          organization_id: string;
          previous_value?: Json | null;
          reason?: string | null;
          result?: string;
          target_user_id: string;
        };
        Update: {
          action?: string;
          actor_user_id?: string | null;
          created_at?: string;
          id?: string;
          new_value?: Json | null;
          organization_id?: string;
          previous_value?: Json | null;
          reason?: string | null;
          result?: string;
          target_user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "permission_audit_entries_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      process_documents: {
        Row: {
          created_at: string;
          created_by: string | null;
          department: string;
          file_name: string;
          file_path: string;
          file_size: number | null;
          id: string;
          organization_id: string;
          process_description: string | null;
          process_id: string;
          process_name: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          department?: string;
          file_name: string;
          file_path: string;
          file_size?: number | null;
          id?: string;
          organization_id?: string;
          process_description?: string | null;
          process_id: string;
          process_name: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          department?: string;
          file_name?: string;
          file_path?: string;
          file_size?: number | null;
          id?: string;
          organization_id?: string;
          process_description?: string | null;
          process_id?: string;
          process_name?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "process_documents_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          display_name: string | null;
          id: string;
          organization_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          id?: string;
          organization_id?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          id?: string;
          organization_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      push_subscriptions: {
        Row: {
          auth: string;
          created_at: string;
          device_label: string | null;
          endpoint: string;
          expiration_time: string | null;
          id: string;
          is_active: boolean;
          last_seen_at: string;
          organization_id: string;
          p256dh: string;
          updated_at: string;
          user_agent: string | null;
          user_id: string;
        };
        Insert: {
          auth: string;
          created_at?: string;
          device_label?: string | null;
          endpoint: string;
          expiration_time?: string | null;
          id?: string;
          is_active?: boolean;
          last_seen_at?: string;
          organization_id?: string;
          p256dh: string;
          updated_at?: string;
          user_agent?: string | null;
          user_id: string;
        };
        Update: {
          auth?: string;
          created_at?: string;
          device_label?: string | null;
          endpoint?: string;
          expiration_time?: string | null;
          id?: string;
          is_active?: boolean;
          last_seen_at?: string;
          organization_id?: string;
          p256dh?: string;
          updated_at?: string;
          user_agent?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      request_messages: {
        Row: {
          content: string;
          created_at: string;
          id: string;
          is_from_team: boolean;
          organization_id: string;
          request_id: string;
          user_id: string;
        };
        Insert: {
          content: string;
          created_at?: string;
          id?: string;
          is_from_team?: boolean;
          organization_id?: string;
          request_id: string;
          user_id: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          id?: string;
          is_from_team?: boolean;
          organization_id?: string;
          request_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "request_messages_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "request_messages_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "client_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      saved_reports: {
        Row: {
          auto_generate: boolean;
          column_keys: string[];
          created_at: string;
          dataset_id: string;
          format: string;
          id: string;
          name: string;
          normalized_name: string | null;
          organization_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          auto_generate?: boolean;
          column_keys: string[];
          created_at?: string;
          dataset_id: string;
          format?: string;
          id?: string;
          name: string;
          normalized_name?: string | null;
          organization_id?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          auto_generate?: boolean;
          column_keys?: string[];
          created_at?: string;
          dataset_id?: string;
          format?: string;
          id?: string;
          name?: string;
          normalized_name?: string | null;
          organization_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "saved_reports_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      site_leads: {
        Row: {
          company_name: string | null;
          created_at: string;
          email: string;
          full_name: string;
          id: string;
          message: string | null;
          organization_id: string;
          origin_page: string | null;
          phone: string | null;
          source_tag: string;
        };
        Insert: {
          company_name?: string | null;
          created_at?: string;
          email: string;
          full_name: string;
          id?: string;
          message?: string | null;
          organization_id?: string;
          origin_page?: string | null;
          phone?: string | null;
          source_tag?: string;
        };
        Update: {
          company_name?: string | null;
          created_at?: string;
          email?: string;
          full_name?: string;
          id?: string;
          message?: string | null;
          organization_id?: string;
          origin_page?: string | null;
          phone?: string | null;
          source_tag?: string;
        };
        Relationships: [
          {
            foreignKeyName: "site_leads_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      tax_regime_definitions: {
        Row: {
          aliases: string[];
          code: string;
          created_at: string;
          id: string;
          is_active: boolean;
          label: string;
          organization_id: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          aliases?: string[];
          code: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          label: string;
          organization_id?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          aliases?: string[];
          code?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          label?: string;
          organization_id?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tax_regime_definitions_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      user_module_grants: {
        Row: {
          created_at: string;
          granted_by: string | null;
          id: string;
          module_key: string;
          organization_id: string;
          source: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          granted_by?: string | null;
          id?: string;
          module_key: string;
          organization_id: string;
          source?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          granted_by?: string | null;
          id?: string;
          module_key?: string;
          organization_id?: string;
          source?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_module_grants_access_fk";
            columns: ["organization_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "organization_user_access";
            referencedColumns: ["organization_id", "user_id"];
          },
          {
            foreignKeyName: "user_module_grants_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          organization_id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          organization_id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          organization_id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      user_settings: {
        Row: {
          compact_mode: boolean;
          company_document: string | null;
          company_email: string | null;
          company_name: string | null;
          company_phone: string | null;
          company_website: string | null;
          created_at: string;
          id: string;
          integrations_api_access: boolean;
          integrations_calendar_sync: boolean;
          integrations_drive_sync: boolean;
          integrations_webhook_url: string | null;
          job_title: string | null;
          language_code: string;
          notify_assigned_tasks: boolean;
          notify_daily_email: boolean;
          notify_due_soon: boolean;
          notify_new_forms: boolean;
          notify_new_leads: boolean;
          organization_id: string;
          phone: string | null;
          theme_preference: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          compact_mode?: boolean;
          company_document?: string | null;
          company_email?: string | null;
          company_name?: string | null;
          company_phone?: string | null;
          company_website?: string | null;
          created_at?: string;
          id?: string;
          integrations_api_access?: boolean;
          integrations_calendar_sync?: boolean;
          integrations_drive_sync?: boolean;
          integrations_webhook_url?: string | null;
          job_title?: string | null;
          language_code?: string;
          notify_assigned_tasks?: boolean;
          notify_daily_email?: boolean;
          notify_due_soon?: boolean;
          notify_new_forms?: boolean;
          notify_new_leads?: boolean;
          organization_id?: string;
          phone?: string | null;
          theme_preference?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          compact_mode?: boolean;
          company_document?: string | null;
          company_email?: string | null;
          company_name?: string | null;
          company_phone?: string | null;
          company_website?: string | null;
          created_at?: string;
          id?: string;
          integrations_api_access?: boolean;
          integrations_calendar_sync?: boolean;
          integrations_drive_sync?: boolean;
          integrations_webhook_url?: string | null;
          job_title?: string | null;
          language_code?: string;
          notify_assigned_tasks?: boolean;
          notify_daily_email?: boolean;
          notify_due_soon?: boolean;
          notify_new_forms?: boolean;
          notify_new_leads?: boolean;
          organization_id?: string;
          phone?: string | null;
          theme_preference?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_settings_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      whatsapp_webhook_logs: {
        Row: {
          cliente_id: string | null;
          created_at: string;
          direction: string;
          id: string;
          message_type: string | null;
          organization_id: string;
          payload: Json;
          phone: string | null;
          processing_status: string;
          provider_message_id: string | null;
          user_id: string | null;
        };
        Insert: {
          cliente_id?: string | null;
          created_at?: string;
          direction: string;
          id?: string;
          message_type?: string | null;
          organization_id?: string;
          payload?: Json;
          phone?: string | null;
          processing_status?: string;
          provider_message_id?: string | null;
          user_id?: string | null;
        };
        Update: {
          cliente_id?: string | null;
          created_at?: string;
          direction?: string;
          id?: string;
          message_type?: string | null;
          organization_id?: string;
          payload?: Json;
          phone?: string | null;
          processing_status?: string;
          provider_message_id?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "whatsapp_webhook_logs_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "acessorias_report_overview";
            referencedColumns: ["client_id"];
          },
          {
            foreignKeyName: "whatsapp_webhook_logs_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "whatsapp_webhook_logs_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      acessorias_report_overview: {
        Row: {
          acessorias_company_id: string | null;
          acessorias_company_name: string | null;
          acessorias_company_status: string | null;
          client_cnpj: string | null;
          client_id: string | null;
          client_name: string | null;
          client_status: string | null;
          link_last_synced_at: string | null;
          match_type: string | null;
          obligations_last_synced_at: string | null;
          obligations_overdue: number | null;
          obligations_pending: number | null;
          obligations_total: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      admin_apply_user_access: {
        Args: {
          _change_reason?: string;
          _display_name: string;
          _enabled_modules?: string[];
          _linked_client_ids?: string[];
          _organization_id: string;
          _primary_role: string;
          _sector_code?: string;
          _status: string;
          _target_user_id: string;
        };
        Returns: Json;
      };
      admin_list_permission_audit: {
        Args: {
          _action?: string;
          _actor_user_id?: string;
          _date_from?: string;
          _date_to?: string;
          _organization_id: string;
          _page?: number;
          _page_size?: number;
          _target_user_id?: string;
        };
        Returns: Json;
      };
      admin_list_user_access: {
        Args: {
          _client_id?: string;
          _module_key?: string;
          _organization_id: string;
          _page?: number;
          _page_size?: number;
          _requires_access_review?: boolean;
          _role?: string;
          _search?: string;
          _sector_code?: string;
          _status?: string;
        };
        Returns: Json;
      };
      list_task_assignees: {
        Args: { _organization_id: string };
        Returns: {
          display_name: string;
          sector_code: string | null;
          user_id: string;
        }[];
      };
      can_access_client: {
        Args: { _client_id: string; _user_id: string };
        Returns: boolean;
      };
      can_access_client_cashflow: {
        Args: { _client_id: string };
        Returns: boolean;
      };
      can_access_client_open_finance: {
        Args: { _client_id: string };
        Returns: boolean;
      };
      can_access_kanban_task: {
        Args: { _organization_id: string; _task_id: string; _user_id: string };
        Returns: boolean;
      };
      can_access_task_sector: {
        Args: { _organization_id: string; _sector: string; _user_id: string };
        Returns: boolean;
      };
      can_access_task_values: {
        Args: {
          _assigned_to_user_id: string;
          _organization_id: string;
          _sector: string;
          _user_id: string;
        };
        Returns: boolean;
      };
      canonical_task_sector: { Args: { _sector: string }; Returns: string };
      cleanup_open_finance_transactions: { Args: never; Returns: number };
      current_organization_id: { Args: never; Returns: string };
      default_organization_id: { Args: never; Returns: string };
      find_matching_cashflow_rule: {
        Args: { _client_id: string; _description: string; _entry_type: string };
        Returns: {
          auto_approve_threshold: number;
          category: string;
          counterparty_name: string;
          mark_as_transfer: boolean;
          match_confidence: number;
          rule_id: string;
        }[];
      };
      get_manual_adoption_snapshot: {
        Args: {
          p_context_key?: string;
          p_period_days?: number;
          p_profile?: string;
        };
        Returns: {
          avg_completion: number;
          completed_users: number;
          context_key: string;
          module_key: string;
          pending_users: number;
          profile: string;
          total_users: number;
        }[];
      };
      get_my_effective_access: {
        Args: { _organization_id: string };
        Returns: {
          active_client_ids: string[];
          enabled_modules: string[];
          organization_id: string;
          primary_role: string;
          requires_access_review: boolean;
          sector_code: string;
          status: string;
          user_id: string;
        }[];
      };
      has_canonical_org_role: {
        Args: { _organization_id: string; _role: string; _user_id: string };
        Returns: boolean;
      };
      has_effective_module_access: {
        Args: {
          _module_key: string;
          _organization_id: string;
          _user_id: string;
        };
        Returns: boolean;
      };
      has_org_role: {
        Args: {
          _organization_id: string;
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      infer_cashflow_category_from_obligation: {
        Args: { _entry_type: string; _obligation_name: string };
        Returns: string;
      };
      is_canonical_internal_user: {
        Args: { _organization_id: string; _user_id: string };
        Returns: boolean;
      };
      is_internal_user:
        | { Args: { _user_id: string }; Returns: boolean }
        | {
            Args: { _organization_id: string; _user_id: string };
            Returns: boolean;
          };
      is_permission_admin: {
        Args: { _organization_id: string };
        Returns: boolean;
      };
      list_admin_users: {
        Args: never;
        Returns: {
          created_at: string;
          display_name: string;
          email: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        }[];
      };
      list_internal_user_profiles:
        | {
            Args: never;
            Returns: {
              display_name: string;
              user_id: string;
            }[];
          }
        | {
            Args: { _organization_id: string };
            Returns: {
              display_name: string;
              user_id: string;
            }[];
          };
      normalize_cashflow_match_text: {
        Args: { _value: string };
        Returns: string;
      };
      normalize_task_sector: { Args: { _sector: string }; Returns: string };
      record_operational_audit_log: {
        Args: {
          _action: string;
          _client_id?: string;
          _entity_id?: string;
          _entity_type?: string;
          _metadata?: Json;
          _organization_id: string;
          _request_id?: string;
          _result?: string;
        };
        Returns: string;
      };
      refresh_client_cashflow_consultive_state: {
        Args: { _client_id: string };
        Returns: Json;
      };
      resolve_cashflow_consultive_alerts: {
        Args: { _active_alert_keys?: string[]; _client_id: string };
        Returns: undefined;
      };
      resolve_cashflow_consultive_tasks: {
        Args: { _active_task_ids?: string[]; _client_id: string };
        Returns: undefined;
      };
      sync_cashflow_projection_from_obligation: {
        Args: { _obligation_id: string };
        Returns: undefined;
      };
      unaccent: { Args: { "": string }; Returns: string };
      upsert_cashflow_consultive_task: {
        Args: {
          _client_id: string;
          _description: string;
          _due_date: string;
          _integration_task_id: string;
          _payload?: Json;
          _priority: string;
          _title: string;
        };
        Returns: undefined;
      };
      upsert_client_cashflow_consultive_alert: {
        Args: {
          _client_id: string;
          _message: string;
          _metadata?: Json;
          _severity: string;
          _source_key: string;
          _title: string;
        };
        Returns: string;
      };
    };
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
        | "contabil";
      request_status: "pending" | "in_progress" | "completed" | "cancelled";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

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
} as const;
