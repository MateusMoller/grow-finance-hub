begin;
select plan(11);
select has_function('private','transition_fiscal_sync_run',array['uuid','text','text','text']);
select has_function('private','claim_integra_token_refresh',array['uuid','uuid','integer']);
select has_function('private','store_integra_tokens',array['uuid','uuid','bigint','text','text','timestamp with time zone']);

insert into public.organizations (id, slug, name)
values ('10000000-0000-0000-0000-000000000001', 'integra-job-test', 'Integra job test');
insert into public.clients (id, organization_id, name)
values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Fiscal client');
insert into public.integra_contador_connections (id, organization_id, environment, contractor_tax_id)
values ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'validation', '00000000000000');
insert into public.fiscal_sync_runs
  (id, organization_id, client_id, connection_id, capability_key, reason, source, correlation_id, request_fingerprint)
values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'caixa_postal.new_message_indicator', 'user_request', 'test', '50000000-0000-0000-0000-000000000001', 'job-test');

select ok(private.transition_fiscal_sync_run('40000000-0000-0000-0000-000000000001', 'queued', 'processing'), 'expected state transition succeeds');
select ok(not private.transition_fiscal_sync_run('40000000-0000-0000-0000-000000000001', 'queued', 'completed'), 'stale expected state transition is rejected');
select is((select status from public.fiscal_sync_runs where id='40000000-0000-0000-0000-000000000001'), 'processing', 'rejected transition does not change state');

select is(private.claim_integra_token_refresh('30000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 30), 1::bigint, 'first token owner acquires lease');
select is(private.claim_integra_token_refresh('30000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002', 30), null::bigint, 'concurrent token owner cannot steal lease');
select ok(private.store_integra_tokens('30000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 1, 'cipher-a', 'cipher-j', now()+interval '5 minutes'), 'lease owner stores token');

select private.fiscal_queue_send('fiscal-sync', jsonb_build_object('runId','40000000-0000-0000-0000-000000000001')) as queued_message_id \gset
select is((select count(*)::integer from pgmq.read('fiscal-sync', 0, 1)), 1, 'queue message is claimable');
select is((select count(*)::integer from pgmq.read('fiscal-sync', 30, 1)), 1, 'expired visibility makes unarchived message redeliverable');

select * from finish(); rollback;
