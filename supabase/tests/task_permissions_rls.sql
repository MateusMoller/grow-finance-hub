begin;
select plan(4);

select policies_are('public', 'kanban_tasks', array[
  'Tenant users insert canonical task scope',
  'Tenant users update canonical task scope',
  'Tenant users view canonical task scope'
], 'task policies are canonical and contain no physical DELETE policy');

select function_privs_are(
  'public', 'can_access_task_values', array['uuid','uuid','text','uuid'], 'authenticated', array['EXECUTE'],
  'authenticated can execute only the identity-bound RLS helper'
);
select hasnt_function_privilege('anon', 'public.can_access_task_values(uuid,uuid,text,uuid)', 'EXECUTE', 'anon cannot probe task access');
select hasnt_function_privilege('public', 'public.mutate_tasks_canonical(uuid,uuid,text,jsonb,text,text)', 'EXECUTE', 'PUBLIC cannot mutate tasks canonically');

select * from finish();
rollback;
