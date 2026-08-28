begin;
select plan(12);

select ok(not has_table_privilege('anon','public.integra_contador_connections','select'),'anon cannot read connections');
select ok(not has_table_privilege('authenticated','public.integra_contador_connections','select'),'authenticated cannot read secret references directly');
select ok(not has_table_privilege('authenticated','public.fiscal_procurations','insert,update,delete'),'authenticated cannot mutate procurations directly');
select ok(not has_table_privilege('authenticated','public.fiscal_sync_runs','insert,update,delete'),'authenticated cannot mutate runs directly');
select ok(not has_table_privilege('authenticated','public.fiscal_operations','select,insert,update,delete'),'authenticated has no direct operations access');
select ok(not has_table_privilege('authenticated','public.fiscal_request_cache','insert,update,delete'),'authenticated cannot mutate cache directly');
select ok(not has_table_privilege('authenticated','public.receita_event_states','insert,update,delete'),'authenticated cannot mutate event state directly');
select ok(not has_table_privilege('authenticated','public.serpro_api_usage','select,insert,update,delete'),'authenticated has no direct usage access');
select ok(not has_table_privilege('authenticated','public.fiscal_documents','select,insert,update,delete'),'authenticated has no direct fiscal document access');
select ok(not has_table_privilege('authenticated','public.fiscal_reviews','insert,update,delete'),'authenticated cannot mutate reviews directly');
select ok(not has_table_privilege('anon','private.integra_contador_token_cache','select'),'anon cannot read token cache');
select ok(not has_table_privilege('authenticated','private.integra_contador_token_cache','select,insert,update,delete'),'authenticated cannot access token cache');

select * from finish(); rollback;
