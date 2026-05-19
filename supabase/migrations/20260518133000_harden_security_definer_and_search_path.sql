-- Reduce RPC exposure for privileged helper/trigger functions and pin search_path
-- on project-owned functions flagged by the Supabase security advisor.

REVOKE ALL ON FUNCTION public.apply_cashflow_rule_match() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_open_finance_transactions() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_kanban_from_request() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_admin_cashflow_release() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_grow_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_internal_user_client_link() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_mixed_portal_internal_roles() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_inactive_client_access() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_client_cashflow_entry_phase1_fields() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.can_access_client_cashflow(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_client_open_finance(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_manual_adoption_snapshot(text, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_admin_users() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_internal_user_profiles() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_operational_audit_log(uuid, text, text, uuid, uuid, text, jsonb, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.can_access_client_cashflow(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_client_open_finance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_manual_adoption_snapshot(text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_admin_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_internal_user_profiles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_operational_audit_log(uuid, text, text, uuid, uuid, text, jsonb, text) TO authenticated;

ALTER FUNCTION public.enforce_clients_uniqueness_guard() SET search_path = public;
ALTER FUNCTION public.handle_cashflow_consultive_calendar_refresh() SET search_path = public;
ALTER FUNCTION public.handle_client_acessorias_obligation_projection() SET search_path = public;
ALTER FUNCTION public.handle_client_cashflow_access_toggle() SET search_path = public;
ALTER FUNCTION public.handle_client_cashflow_consultive_entry_refresh() SET search_path = public;
ALTER FUNCTION public.infer_cashflow_category_from_obligation(text, text) SET search_path = public;
ALTER FUNCTION public.normalize_cashflow_match_text(text) SET search_path = public;
ALTER FUNCTION public.refresh_client_cashflow_consultive_state(uuid) SET search_path = public;
ALTER FUNCTION public.resolve_cashflow_consultive_alerts(uuid, text[]) SET search_path = public;
ALTER FUNCTION public.resolve_cashflow_consultive_tasks(uuid, text[]) SET search_path = public;
ALTER FUNCTION public.search_kb_chunks(vector, integer) SET search_path = public;
ALTER FUNCTION public.sync_cashflow_projection_from_obligation(uuid) SET search_path = public;
ALTER FUNCTION public.upsert_cashflow_consultive_task(uuid, text, text, text, text, date, jsonb) SET search_path = public;
ALTER FUNCTION public.upsert_client_cashflow_consultive_alert(uuid, text, text, text, text, jsonb) SET search_path = public;
