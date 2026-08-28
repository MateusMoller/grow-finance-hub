-- Temporarily retire Integra Contador without deleting historical fiscal data.
update public.organization_settings
set feature_flags = jsonb_set(coalesce(feature_flags, '{}'::jsonb), '{integra_contador}', 'false'::jsonb, true),
    updated_at = now()
where coalesce((feature_flags ->> 'integra_contador')::boolean, false);

update public.integra_contador_connections
set status = 'disabled', updated_at = now()
where status <> 'disabled';

do $$
declare
  job record;
begin
  for job in
    select jobid
    from cron.job
    where jobname in (
      'integra-contador-monitor',
      'integra-contador-worker',
      'integra-contador-reconcile',
      'integra-contador-retention'
    )
  loop
    perform cron.unschedule(job.jobid);
  end loop;
end
$$;
