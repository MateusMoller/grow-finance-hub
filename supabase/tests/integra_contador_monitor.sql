begin;select plan(6);
select has_table('public','fiscal_monitor_runs','monitor runs exist');
select ok((select relrowsecurity from pg_class where oid='public.fiscal_monitor_runs'::regclass),'monitor runs enforce RLS');
select ok((select indisunique and indpred is not null from pg_index where indexrelid='public.fiscal_monitor_active_uidx'::regclass),'active monitor claim deduplicates');
select ok((select indisunique and indpred is not null from pg_index where indexrelid='public.receita_event_fingerprint_uidx'::regclass),'event fingerprints deduplicate');
select has_column('public','receita_event_states','reconciliation_reason','reconciliation reason recorded');
select ok(not has_function_privilege('authenticated','public.claim_integra_contador_monitor_run(uuid,integer)','execute'),'users cannot claim monitor jobs');
select * from finish();rollback;
