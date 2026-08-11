-- Repair legacy obligation tasks that have a technical instance link but no origin metadata.
update public.kanban_tasks as task
set
  integration_source = 'grow_obligation_task',
  integration_task_id = coalesce(
    task.integration_task_id,
    'instance:' || (task.integration_payload ->> 'instance_id')
  )
where coalesce(task.integration_source, '') <> 'grow_obligation_task'
  and exists (
    select 1
    from public.obligation_instances as instance
    where instance.id::text = case
      when task.integration_task_id like 'instance:%'
        then substring(task.integration_task_id from length('instance:') + 1)
      else task.integration_payload ->> 'instance_id'
    end
  );
