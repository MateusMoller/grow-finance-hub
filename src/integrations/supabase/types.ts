export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      calendar_events: {
        Row: {
          all_day: boolean | null
          assignee: string | null
          client_name: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_at: string
          entry_type: string
          id: string
          priority: string
          sector: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean | null
          assignee?: string | null
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string
          entry_type?: string
          id?: string
          priority?: string
          sector?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean | null
          assignee?: string | null
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string
          entry_type?: string
          id?: string
          priority?: string
          sector?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_data: {
        Row: {
          category: string
          client_id: string
          created_at: string
          created_by: string | null
          field_name: string
          field_value: string | null
          id: string
          period: string | null
          updated_at: string
        }
        Insert: {
          category?: string
          client_id: string
          created_at?: string
          created_by?: string | null
          field_name: string
          field_value?: string | null
          id?: string
          period?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          field_name?: string
          field_value?: string | null
          id?: string
          period?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_data_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_documents: {
        Row: {
          category: string
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          processed_at: string | null
          processed_by: string | null
          request_id: string | null
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          request_id?: string | null
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          file_name?: string
          file_pathá: string
          file_size?: number | null
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          request_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_documents_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_documents_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "client_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      client_files: {
        Row: {
          category: string
          client_id: string
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          uploaded_by: string | null
        }
        Insert: {
          category?: string
          client_id: string
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          uploaded_by?: string | null
        }
        Update: {
          category?: string
          client_id?: string
          created_at?: string
          file_name?: string
          file_pathá: string
          file_size?: number | null
          id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_files_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      process_documents: {
        Row: {
          created_at: string
          created_by: string | null
          department: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          process_description: string | null
          process_id: string
          process_name: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          process_description?: string | null
          process_id: string
          process_name: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department?: string
          file_name?: string
          file_pathá: string
          file_size?: number | null
          id?: string
          process_description?: string | null
          process_id?: string
          process_name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          device_label: string | null
          endpoint: string
          expiration_time: string | null
          id: string
          is_active: boolean
          last_seen_at: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          device_label?: string | null
          endpoint: string
          expiration_time?: string | null
          id?: string
          is_active?: boolean
          last_seen_at?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          authá: string
          created_at?: string
          device_label?: string | null
          endpoint?: string
          expiration_time?: string | null
          id?: string
          is_active?: boolean
          last_seen_at?: string
          p256dhá: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      client_requests: {
        Row: {
          admin_notes: string | null
          category: string
          created_at: string
          description: string | null
          id: string
          sector: string
          status: Database["public"]["Enums"]["request_status"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          sector?: string
          status?: Database["public"]["Enums"]["request_status"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          sector?: string
          status?: Database["public"]["Enums"]["request_status"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          address: string | null
          cnpj: string | null
          contact: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          obligation_completion_whatsapp_enabled: boolean
          phone: string | null
          portal_cashflow_enabled: boolean
          portal_user_id: string | null
          regime: string | null
          sector: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          cnpj?: string | null
          contact?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          obligation_completion_whatsapp_enabled?: boolean
          phone?: string | null
          portal_cashflow_enabled?: boolean
          portal_user_id?: string | null
          regime?: string | null
          sector?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          cnpj?: string | null
          contact?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          obligation_completion_whatsapp_enabled?: boolean
          phone?: string | null
          portal_cashflow_enabled?: boolean
          portal_user_id?: string | null
          regime?: string | null
          sector?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_portal_user_id_fkey"
            columns: ["portal_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      client_cashflow_accounts: {
        Row: {
          account_mask: string | null
          client_id: string
          created_at: string
          currency_code: string
          id: string
          institution_name: string | null
          is_active: boolean
          is_primary: boolean
          label: string
          notes: string | null
          open_finance_account_id: string | null
          open_finance_connection_id: string | null
          source_type: string
          updated_at: string
        }
        Insert: {
          account_mask?: string | null
          client_id: string
          created_at?: string
          currency_code?: string
          id?: string
          institution_name?: string | null
          is_active?: boolean
          is_primary?: boolean
          label: string
          notes?: string | null
          open_finance_account_id?: string | null
          open_finance_connection_id?: string | null
          source_type?: string
          updated_at?: string
        }
        Update: {
          account_mask?: string | null
          client_id?: string
          created_at?: string
          currency_code?: string
          id?: string
          institution_name?: string | null
          is_active?: boolean
          is_primary?: boolean
          label?: string
          notes?: string | null
          open_finance_account_id?: string | null
          open_finance_connection_id?: string | null
          source_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_cashflow_accounts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_cashflow_accounts_open_finance_account_id_fkey"
            columns: ["open_finance_account_id"]
            isOneToOne: false
            referencedRelation: "open_finance_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_cashflow_accounts_open_finance_connection_id_fkey"
            columns: ["open_finance_connection_id"]
            isOneToOne: false
            referencedRelation: "open_finance_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      client_cashflow_rules: {
        Row: {
          auto_approve_threshold: number
          category: string
          client_id: string | null
          counterparty_name: string | null
          created_at: string
          created_by: string | null
          entry_type: string
          id: string
          is_active: boolean
          mark_as_transfer: boolean
          match_text: string
          notes: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          auto_approve_threshold?: number
          category: string
          client_id?: string | null
          counterparty_name?: string | null
          created_at?: string
          created_by?: string | null
          entry_type?: string
          id?: string
          is_active?: boolean
          mark_as_transfer?: boolean
          match_text: string
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          auto_approve_threshold?: number
          category?: string
          client_id?: string | null
          counterparty_name?: string | null
          created_at?: string
          created_by?: string | null
          entry_type?: string
          id?: string
          is_active?: boolean
          mark_as_transfer?: boolean
          match_text?: string
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_cashflow_rules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_cashflow_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_cashflow_rules_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      client_cashflow_entries: {
        Row: {
          account_id: string | null
          amount: number
          category: string
          client_id: string
          competence_month: string | null
          counterparty_name: string | null
          created_at: string
          created_by: string | null
          description: string
          document_ref: string | null
          due_date: string | null
          effective_date: string | null
          entry_date: string
          entry_type: string
          id: string
          integration_account_id: string | null
          integration_connection_id: string | null
          integration_key: string | null
          integration_source: string | null
          is_hidden_from_projection: boolean
          is_transfer: boolean
          lifecycle_status: string | null
          matched_rule_id: string | null
          notes: string | null
          origin_type: string | null
          reconciliation_status: string | null
          review_owner_id: string | null
          review_status: string | null
          reviewed_at: string | null
          rule_match_confidence: number | null
          status: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          category?: string
          client_id: string
          competence_month?: string | null
          counterparty_name?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          document_ref?: string | null
          due_date?: string | null
          effective_date?: string | null
          entry_date?: string
          entry_type?: string
          id?: string
          integration_account_id?: string | null
          integration_connection_id?: string | null
          integration_key?: string | null
          integration_source?: string | null
          is_hidden_from_projection?: boolean
          is_transfer?: boolean
          lifecycle_status?: string | null
          matched_rule_id?: string | null
          notes?: string | null
          origin_type?: string | null
          reconciliation_status?: string | null
          review_owner_id?: string | null
          review_status?: string | null
          reviewed_at?: string | null
          rule_match_confidence?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category?: string
          client_id?: string
          competence_month?: string | null
          counterparty_name?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          document_ref?: string | null
          due_date?: string | null
          effective_date?: string | null
          entry_date?: string
          entry_type?: string
          id?: string
          integration_account_id?: string | null
          integration_connection_id?: string | null
          integration_key?: string | null
          integration_source?: string | null
          is_hidden_from_projection?: boolean
          is_transfer?: boolean
          lifecycle_status?: string | null
          matched_rule_id?: string | null
          notes?: string | null
          origin_type?: string | null
          reconciliation_status?: string | null
          review_owner_id?: string | null
          review_status?: string | null
          reviewed_at?: string | null
          rule_match_confidence?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_cashflow_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "client_cashflow_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_cashflow_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_cashflow_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_cashflow_entries_integration_account_id_fkey"
            columns: ["integration_account_id"]
            isOneToOne: false
            referencedRelation: "open_finance_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_cashflow_entries_integration_connection_id_fkey"
            columns: ["integration_connection_id"]
            isOneToOne: false
            referencedRelation: "open_finance_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_cashflow_entries_matched_rule_id_fkey"
            columns: ["matched_rule_id"]
            isOneToOne: false
            referencedRelation: "client_cashflow_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_cashflow_entries_review_owner_id_fkey"
            columns: ["review_owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      client_cashflow_consultive_alerts: {
        Row: {
          client_id: string
          created_at: string
          id: string
          message: string
          metadata: Json
          resolved_at: string | null
          severity: string
          source_key: string
          source_type: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          message: string
          metadata?: Json
          resolved_at?: string | null
          severity?: string
          source_key: string
          source_type: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          message?: string
          metadata?: Json
          resolved_at?: string | null
          severity?: string
          source_key?: string
          source_type?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_cashflow_consultive_alerts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_cashflow_health_snapshots: {
        Row: {
          client_id: string
          critical_calendar_events: number
          current_balance: number
          generated_at: string
          health_status: string
          last_activity_at: string | null
          metadata: Json
          overdue_entries: number
          pending_reconciliation_entries: number
          pending_review_entries: number
          projected_balance_15: number
          projected_balance_30: number
          projected_balance_7: number
          projected_gap_date: string | null
          review_coverage: number
          updated_at: string
        }
        Insert: {
          client_id: string
          critical_calendar_events?: number
          current_balance?: number
          generated_at?: string
          health_status?: string
          last_activity_at?: string | null
          metadata?: Json
          overdue_entries?: number
          pending_reconciliation_entries?: number
          pending_review_entries?: number
          projected_balance_15?: number
          projected_balance_30?: number
          projected_balance_7?: number
          projected_gap_date?: string | null
          review_coverage?: number
          updated_at?: string
        }
        Update: {
          client_id?: string
          critical_calendar_events?: number
          current_balance?: number
          generated_at?: string
          health_status?: string
          last_activity_at?: string | null
          metadata?: Json
          overdue_entries?: number
          pending_reconciliation_entries?: number
          pending_review_entries?: number
          projected_balance_15?: number
          projected_balance_30?: number
          projected_balance_7?: number
          projected_gap_date?: string | null
          review_coverage?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_cashflow_health_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_portal_tasks: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          request_id: string | null
          sector: string
          status: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          request_id?: string | null
          sector?: string
          status?: string
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          request_id?: string | null
          sector?: string
          status?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_portal_tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_portal_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_portal_tasks_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "client_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      form_submissions: {
        Row: {
          client_id: string | null
          created_at: string
          data: Json | null
          id: string
          notes: string | null
          request_id: string | null
          status: string | null
          submitted_by: string | null
          submitted_by_name: string | null
          template_id: string | null
          template_title: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          notes?: string | null
          request_id?: string | null
          status?: string | null
          submitted_by?: string | null
          submitted_by_name?: string | null
          template_id?: string | null
          template_title: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          notes?: string | null
          request_id?: string | null
          status?: string | null
          submitted_by?: string | null
          submitted_by_name?: string | null
          template_id?: string | null
          template_title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "client_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "form_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      form_templates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          fields: Json | null
          id: string
          is_published: boolean | null
          sector: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          fields?: Json | null
          id?: string
          is_published?: boolean | null
          sector?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          fields?: Json | null
          id?: string
          is_published?: boolean | null
          sector?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      kanban_tasks: {
        Row: {
          assignee: string | null
          client_name: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: string
          request_id: string | null
          sector: string
          status: string
          subtasks: Json
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          assignee?: string | null
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          request_id?: string | null
          sector?: string
          status?: string
          subtasks?: Json
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          assignee?: string | null
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          request_id?: string | null
          sector?: string
          status?: string
          subtasks?: Json
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanban_tasks_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "client_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
          source: string | null
          status: string
          subscribed_at: string
          unsubscribed_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          source?: string | null
          status?: string
          subscribed_at?: string
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          source?: string | null
          status?: string
          subscribed_at?: string
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      newsletters: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          email_send_error: string | null
          email_sent_at: string | null
          excerpt: string | null
          id: string
          is_published: boolean
          published_at: string | null
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          email_send_error?: string | null
          email_sent_at?: string | null
          excerpt?: string | null
          id?: string
          is_published?: boolean
          published_at?: string | null
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          email_send_error?: string | null
          email_sent_at?: string | null
          excerpt?: string | null
          id?: string
          is_published?: boolean
          published_at?: string | null
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletters_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      email_inbox_messages: {
        Row: {
          created_at: string
          from_email: string
          html_content: string | null
          id: string
          preview: string | null
          provider: string
          provider_message_id: string | null
          read_at: string | null
          received_at: string
          source_payload: Json | null
          subject: string
          text_content: string | null
          to_email: string
        }
        Insert: {
          created_at?: string
          from_email: string
          html_content?: string | null
          id?: string
          preview?: string | null
          provider?: string
          provider_message_id?: string | null
          read_at?: string | null
          received_at?: string
          source_payload?: Json | null
          subject?: string
          text_content?: string | null
          to_email: string
        }
        Update: {
          created_at?: string
          from_email?: string
          html_content?: string | null
          id?: string
          preview?: string | null
          provider?: string
          provider_message_id?: string | null
          read_at?: string | null
          received_at?: string
          source_payload?: Json | null
          subject?: string
          text_content?: string | null
          to_email?: string
        }
        Relationships: []
      }
      internal_chat_messages: {
        Row: {
          chat_type: string
          content: string
          created_at: string
          id: string
          recipient_user_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          chat_type?: string
          content: string
          created_at?: string
          id?: string
          recipient_user_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          chat_type?: string
          content?: string
          created_at?: string
          id?: string
          recipient_user_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_reports: {
        Row: {
          auto_generate: boolean
          column_keys: string[]
          created_at: string
          dataset_id: string
          format: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_generate?: boolean
          column_keys: string[]
          created_at?: string
          dataset_id: string
          format?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_generate?: boolean
          column_keys?: string[]
          created_at?: string
          dataset_id?: string
          format?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      request_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          is_from_team: boolean
          request_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_from_team?: boolean
          request_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_from_team?: boolean
          request_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_messages_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "client_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      site_leads: {
        Row: {
          company_name: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          message: string | null
          origin_page: string | null
          phone: string | null
          source_tag: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          message?: string | null
          origin_page?: string | null
          phone?: string | null
          source_tag?: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          message?: string | null
          origin_page?: string | null
          phone?: string | null
          source_tag?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          api_access: boolean | null
          api_token: string | null
          calendar_sync: boolean | null
          compact_mode: boolean | null
          company_document: string | null
          company_email: string | null
          company_name: string | null
          company_phone: string | null
          company_website: string | null
          created_at: string
          drive_sync: boolean | null
          id: string
          job_title: string | null
          language_code: string | null
          notify_assigned_tasks: boolean | null
          notify_daily_email: boolean | null
          notify_due_soon: boolean | null
          notify_new_forms: boolean | null
          notify_new_leads: boolean | null
          phone: string | null
          theme_preference: string | null
          updated_at: string
          user_id: string
          webhook_url: string | null
        }
        Insert: {
          api_access?: boolean | null
          api_token?: string | null
          calendar_sync?: boolean | null
          compact_mode?: boolean | null
          company_document?: string | null
          company_email?: string | null
          company_name?: string | null
          company_phone?: string | null
          company_website?: string | null
          created_at?: string
          drive_sync?: boolean | null
          id?: string
          job_title?: string | null
          language_code?: string | null
          notify_assigned_tasks?: boolean | null
          notify_daily_email?: boolean | null
          notify_due_soon?: boolean | null
          notify_new_forms?: boolean | null
          notify_new_leads?: boolean | null
          phone?: string | null
          theme_preference?: string | null
          updated_at?: string
          user_id: string
          webhook_url?: string | null
        }
        Update: {
          api_access?: boolean | null
          api_token?: string | null
          calendar_sync?: boolean | null
          compact_mode?: boolean | null
          company_document?: string | null
          company_email?: string | null
          company_name?: string | null
          company_phone?: string | null
          company_website?: string | null
          created_at?: string
          drive_sync?: boolean | null
          id?: string
          job_title?: string | null
          language_code?: string | null
          notify_assigned_tasks?: boolean | null
          notify_daily_email?: boolean | null
          notify_due_soon?: boolean | null
          notify_new_forms?: boolean | null
          notify_new_leads?: boolean | null
          phone?: string | null
          theme_preference?: string | null
          updated_at?: string
          user_id?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      list_internal_user_profiles: {
        Args: Record<PropertyKey, never>
        Returns: {
          display_name: string | null
          user_id: string
        }[]
      }
      list_admin_users: {
        Args: Record<PropertyKey, never>
        Returns: {
          created_at: string
          display_name: string | null
          email: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          user_id: string
        }[]
      }
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
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
