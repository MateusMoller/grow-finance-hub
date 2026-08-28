begin;
select plan(6);

select hasnt_table_privilege('anon', 'public.kanban_tasks', 'TRUNCATE', 'anon cannot truncate tasks');
select hasnt_table_privilege('authenticated', 'public.kanban_tasks', 'TRUNCATE', 'authenticated cannot truncate tasks');
select hasnt_table_privilege('anon', 'public.kanban_tasks', 'TRIGGER', 'anon cannot manage task triggers');
select hasnt_table_privilege('authenticated', 'public.kanban_tasks', 'TRIGGER', 'authenticated cannot manage task triggers');
select hasnt_function_privilege('anon', 'public.can_access_task_sector(uuid,uuid,text)', 'EXECUTE', 'anon cannot execute legacy sector helper');
select hasnt_function_privilege('authenticated', 'public.mutate_tasks_canonical(uuid,uuid,text,jsonb,text,text)', 'EXECUTE', 'authenticated cannot bypass task-actions');

select * from finish();
rollback;
