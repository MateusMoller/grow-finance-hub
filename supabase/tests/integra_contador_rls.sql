begin;
select plan(10);

select ok((select relrowsecurity from pg_class where oid = 'public.integra_contador_connections'::regclass), 'connections enforce RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.fiscal_procurations'::regclass), 'procurations enforce RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.fiscal_sync_runs'::regclass), 'sync runs enforce RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.fiscal_operations'::regclass), 'operations enforce RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.fiscal_request_cache'::regclass), 'request cache enforces RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.receita_event_states'::regclass), 'event states enforce RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.serpro_api_usage'::regclass), 'usage enforces RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.fiscal_documents'::regclass), 'documents enforce RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.fiscal_reviews'::regclass), 'reviews enforce RLS');
select ok((select relrowsecurity from pg_class where oid = 'private.integra_contador_token_cache'::regclass), 'private token cache enforces defense-in-depth RLS');

select * from finish(); rollback;
