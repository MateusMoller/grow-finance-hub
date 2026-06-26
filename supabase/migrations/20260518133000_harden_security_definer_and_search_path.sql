-- Reduce RPC exposure for privileged helper/trigger functions and pin search_path
-- on project-owned functions flagged by the Supabase security advisor.

DO $$
DECLARE
  revoke_all_from_public text[] := ARRAY[
    'public.apply_cashflow_rule_match()',
    'public.cleanup_open_finance_transactions()',
    'public.create_kanban_from_request()',
    'public.enforce_admin_cashflow_release()',
    'public.handle_new_grow_user()',
    'public.handle_new_user()',
    'public.prevent_internal_user_client_link()',
    'public.prevent_mixed_portal_internal_roles()',
    'public.revoke_inactive_client_access()',
    'public.sync_client_cashflow_entry_phase1_fields()'
  ];
  revoke_anon_only text[] := ARRAY[
    'public.can_access_client_cashflow(uuid)',
    'public.can_access_client_open_finance(uuid)',
    'public.get_manual_adoption_snapshot(text, text, integer)',
    'public.list_admin_users()',
    'public.list_internal_user_profiles()',
    'public.record_operational_audit_log(uuid, text, text, uuid, uuid, text, jsonb, text)'
  ];
  grant_authenticated text[] := ARRAY[
    'public.can_access_client_cashflow(uuid)',
    'public.can_access_client_open_finance(uuid)',
    'public.get_manual_adoption_snapshot(text, text, integer)',
    'public.list_admin_users()',
    'public.list_internal_user_profiles()',
    'public.record_operational_audit_log(uuid, text, text, uuid, uuid, text, jsonb, text)'
  ];
  search_path_functions text[] := ARRAY[
    'public.enforce_clients_uniqueness_guard()',
    'public.handle_cashflow_consultive_calendar_refresh()',
    'public.handle_client_acessorias_obligation_projection()',
    'public.handle_client_cashflow_access_toggle()',
    'public.handle_client_cashflow_consultive_entry_refresh()',
    'public.infer_cashflow_category_from_obligation(text, text)',
    'public.normalize_cashflow_match_text(text)',
    'public.refresh_client_cashflow_consultive_state(uuid)',
    'public.resolve_cashflow_consultive_alerts(uuid, text[])',
    'public.resolve_cashflow_consultive_tasks(uuid, text[])',
    'public.search_kb_chunks(vector, integer)',
    'public.sync_cashflow_projection_from_obligation(uuid)',
    'public.upsert_cashflow_consultive_task(uuid, text, text, text, text, date, jsonb)',
    'public.upsert_client_cashflow_consultive_alert(uuid, text, text, text, text, jsonb)'
  ];
  function_signature text;
BEGIN
  FOREACH function_signature IN ARRAY revoke_all_from_public LOOP
    IF to_regprocedure(function_signature) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', function_signature);
    END IF;
  END LOOP;

  FOREACH function_signature IN ARRAY revoke_anon_only LOOP
    IF to_regprocedure(function_signature) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', function_signature);
    END IF;
  END LOOP;

  FOREACH function_signature IN ARRAY grant_authenticated LOOP
    IF to_regprocedure(function_signature) IS NOT NULL THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', function_signature);
    END IF;
  END LOOP;

  FOREACH function_signature IN ARRAY search_path_functions LOOP
    IF to_regprocedure(function_signature) IS NOT NULL THEN
      EXECUTE format('ALTER FUNCTION %s SET search_path = public', function_signature);
    END IF;
  END LOOP;
END $$;
