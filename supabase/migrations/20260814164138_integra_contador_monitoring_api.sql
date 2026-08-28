alter table public.fiscal_sync_runs add column if not exists parent_run_id uuid references public.fiscal_sync_runs(id) on delete set null;
create index if not exists fiscal_sync_runs_parent_idx on public.fiscal_sync_runs(parent_run_id) where parent_run_id is not null;
create index if not exists fiscal_sync_runs_monitor_filters_idx on public.fiscal_sync_runs(organization_id,capability_key,status,created_at desc,id desc);

create or replace function public.list_fiscal_sync_runs(_organization_id uuid,_client_id uuid default null,_capability text default null,_statuses text[] default null,_cursor_created_at timestamptz default null,_cursor_id uuid default null,_limit integer default 50)
returns jsonb language plpgsql security definer set search_path=public as $$ begin
 if auth.uid() is null or not public.is_internal_user(auth.uid(),_organization_id) then raise exception 'forbidden' using errcode='42501';end if;
 if _limit<1 or _limit>100 then raise exception 'invalid_limit';end if;
 return coalesce((select jsonb_agg(to_jsonb(r)order by r.created_at desc,r.id desc)from(select f.id,f.client_id,c.name client_name,f.capability_key,f.reason,f.status,f.attempt_count,f.max_attempts,f.next_attempt_at,f.records_received,f.records_changed,f.error_code,f.error_summary,f.parent_run_id,f.created_at,f.finished_at,
  (f.status='failed' and f.error_category in('temporary','timeout','rate_limit') and f.attempt_count>=f.max_attempts) eligible_reprocess
 from public.fiscal_sync_runs f left join public.clients c on c.id=f.client_id where f.organization_id=_organization_id and(_client_id is null or f.client_id=_client_id)and(_capability is null or f.capability_key=_capability)and(_statuses is null or f.status=any(_statuses))and(_cursor_created_at is null or(f.created_at,f.id)<(_cursor_created_at,_cursor_id))order by f.created_at desc,f.id desc limit _limit)r),'[]'::jsonb);
end $$;

create or replace function public.get_fiscal_monitoring_summary(_organization_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$ begin
 if auth.uid() is null or not public.is_internal_user(auth.uid(),_organization_id) then raise exception 'forbidden' using errcode='42501';end if;
 return jsonb_build_object('runs',coalesce((select jsonb_object_agg(status,total)from(select status,count(*)total from public.fiscal_sync_runs where organization_id=_organization_id and created_at>=now()-interval '30 days' group by status)s),'{}'::jsonb),'usage',jsonb_build_object('requests',coalesce((select count(*)from public.serpro_api_usage where organization_id=_organization_id and created_at>=now()-interval '30 days'),0),'successes',coalesce((select count(*)from public.serpro_api_usage where organization_id=_organization_id and success and created_at>=now()-interval '30 days'),0),'cacheHits',coalesce((select count(*)from public.serpro_api_usage where organization_id=_organization_id and cache_hit and created_at>=now()-interval '30 days'),0),'estimatedCost',coalesce((select sum(estimated_cost)from public.serpro_api_usage where organization_id=_organization_id and created_at>=now()-interval '30 days'),0)),'actionRequired',coalesce((select count(*)from public.fiscal_sync_runs where organization_id=_organization_id and status='requires_action'),0),'lastSuccessAt',(select max(finished_at)from public.fiscal_sync_runs where organization_id=_organization_id and status='completed'));
end $$;

create or replace function public.reprocess_fiscal_sync_run(_organization_id uuid,_run_id uuid)
returns uuid language plpgsql security definer set search_path=public,pgmq as $$ declare _old public.fiscal_sync_runs%rowtype;_new_id uuid;_correlation uuid:=gen_random_uuid();begin
 if not public.is_permission_admin(_organization_id) then raise exception 'forbidden' using errcode='42501';end if;
 select * into _old from public.fiscal_sync_runs where id=_run_id and organization_id=_organization_id for share;
 if _old.id is null or _old.status<>'failed' or coalesce(_old.error_category,'') not in('temporary','timeout','rate_limit') or _old.attempt_count<_old.max_attempts then raise exception 'reprocess_not_allowed';end if;
 insert into public.fiscal_sync_runs(organization_id,client_id,connection_id,capability_key,reason,status,requested_by,source,correlation_id,request_fingerprint,parent_run_id,max_attempts)
 values(_old.organization_id,_old.client_id,_old.connection_id,_old.capability_key,'admin_reprocess','queued',auth.uid(),'monitoring_api',_correlation,encode(extensions.digest((_old.request_fingerprint||':'||_correlation)::bytea,'sha256'),'hex'),_old.id,_old.max_attempts)returning id into _new_id;
 perform pgmq.send('fiscal-sync',jsonb_build_object('jobId',_new_id,'organizationId',_old.organization_id,'clientId',_old.client_id,'capabilityKey',_old.capability_key,'correlationId',_correlation));
 perform public.record_operational_audit_log(_organization_id,'integra_contador.sync_reprocessed','fiscal_sync_run',_new_id,_old.client_id,'success',jsonb_build_object('originalRunId',_old.id),_correlation::text);return _new_id;
end $$;

create or replace function public.list_fiscal_clients_status(_organization_id uuid,_offset integer default 0,_limit integer default 25)
returns jsonb language plpgsql security definer set search_path=public as $$ begin
 if auth.uid() is null or not public.is_internal_user(auth.uid(),_organization_id) then raise exception 'forbidden' using errcode='42501';end if;
 return coalesce((select jsonb_agg(to_jsonb(x)order by x.name)from(select c.id,c.name,c.cnpj,c.status,(select status from public.fiscal_sync_runs r where r.client_id=c.id and r.organization_id=_organization_id order by created_at desc limit 1)sync_status,(select fetched_at from public.caixa_postal_indicators i where i.client_id=c.id and i.organization_id=_organization_id)last_fiscal_update from public.clients c where c.organization_id=_organization_id order by c.name offset greatest(_offset,0) limit least(greatest(_limit,1),100))x),'[]'::jsonb);end $$;

revoke all on function public.list_fiscal_sync_runs(uuid,uuid,text,text[],timestamptz,uuid,integer) from public,anon;
revoke all on function public.get_fiscal_monitoring_summary(uuid) from public,anon;
revoke all on function public.reprocess_fiscal_sync_run(uuid,uuid) from public,anon;
revoke all on function public.list_fiscal_clients_status(uuid,integer,integer) from public,anon;
grant execute on function public.list_fiscal_sync_runs(uuid,uuid,text,text[],timestamptz,uuid,integer),public.get_fiscal_monitoring_summary(uuid),public.reprocess_fiscal_sync_run(uuid,uuid),public.list_fiscal_clients_status(uuid,integer,integer) to authenticated;
