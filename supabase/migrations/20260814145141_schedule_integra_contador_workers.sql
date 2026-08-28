create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create or replace function private.invoke_integra_contador_internal(_target text)
returns bigint language plpgsql security definer set search_path='' as $$ declare _url text;_secret text;_service_key text;begin
 if _target not in('monitor','worker','reconcile') then raise exception 'invalid target';end if;
 select decrypted_secret into _url from vault.decrypted_secrets where name='integra_contador_internal_base_url' limit 1;
 select decrypted_secret into _secret from vault.decrypted_secrets where name='integra_contador_internal_worker_secret' limit 1;
 select decrypted_secret into _service_key from vault.decrypted_secrets where name='integra_contador_internal_service_role_key' limit 1;
 if _url is null or _secret is null or _service_key is null then return null;end if;
 return net.http_post(url:=_url||'/functions/v1/'||case when _target='worker' then 'integra-contador-worker' else 'integra-contador-monitor' end,
 body:=jsonb_build_object('action',case when _target='reconcile' then 'reconcile' else 'run' end),headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||_service_key,'x-worker-token',_secret),timeout_milliseconds:=5000);
end $$;
revoke all on function private.invoke_integra_contador_internal(text) from public,anon,authenticated;
do $$ begin
 perform cron.unschedule(jobid) from cron.job where jobname in('integra-contador-monitor','integra-contador-worker','integra-contador-reconcile');
 perform cron.schedule('integra-contador-monitor','*/10 * * * *',$job$select private.invoke_integra_contador_internal('monitor')$job$);
 perform cron.schedule('integra-contador-worker','* * * * *',$job$select private.invoke_integra_contador_internal('worker')$job$);
 perform cron.schedule('integra-contador-reconcile','17 2 * * *',$job$select private.invoke_integra_contador_internal('reconcile')$job$);
end $$;
