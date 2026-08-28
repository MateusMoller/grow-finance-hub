begin;
select plan(4);

select has_table('public', 'operational_audit_logs', 'central operational audit exists');
select has_index('public', 'operational_audit_logs', 'idx_operational_audit_logs_org_action_created_at', 'audit is indexed by action');
select hasnt_table_privilege('anon', 'public.operational_audit_logs', 'INSERT', 'anon cannot forge audit records');
select function_returns('public', 'mutate_tasks_canonical', array['uuid','uuid','text','jsonb','text','text'], 'jsonb', 'canonical mutation returns auditable result');

select * from finish();
rollback;
