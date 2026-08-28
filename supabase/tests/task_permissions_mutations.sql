begin;
select plan(7);

select has_column('public', 'kanban_tasks', 'version', 'tasks have optimistic version');
select has_column('public', 'kanban_tasks', 'deleted_at', 'tasks support logical deletion');
select has_column('public', 'kanban_tasks', 'deleted_by', 'tasks record deletion actor');
select col_default_is('public', 'kanban_tasks', 'version', '1', 'task version starts at one');
select has_function('public', 'authorize_task_action', array['uuid','uuid','uuid','text'], 'canonical authorization exists');
select has_function('public', 'mutate_tasks_canonical', array['uuid','uuid','text','jsonb','text','text'], 'canonical mutation exists');
select hasnt_function_privilege('authenticated', 'public.mutate_tasks_canonical(uuid,uuid,text,jsonb,text,text)', 'EXECUTE', 'human callers cannot invoke service RPC directly');

select * from finish();
rollback;
