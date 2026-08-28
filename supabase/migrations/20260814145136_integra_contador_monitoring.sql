alter table public.receita_event_states
  add column if not exists event_fingerprint text,
  add column if not exists monitor_cursor text,
  add column if not exists reconciliation_reason text,
  add column if not exists claimed_by uuid,
  add column if not exists claimed_until timestamptz;
create unique index if not exists receita_event_fingerprint_uidx on public.receita_event_states(organization_id,event_type,event_fingerprint) where event_fingerprint is not null;
create index if not exists receita_event_claim_idx on public.receita_event_states(status,claimed_until,last_checked_at);

create table public.fiscal_monitor_runs(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 connection_id uuid not null references public.integra_contador_connections(id) on delete cascade,
 event_type text not null, status text not null default 'queued' check(status in('queued','processing','waiting_external','completed','quota_exhausted','failed')),
 cursor_before text,cursor_after text,batch_size integer not null default 0 check(batch_size between 0 and 1000),changed_count integer not null default 0,
 quota_remaining integer,attempt_count integer not null default 0,next_attempt_at timestamptz,reconciliation boolean not null default false,
 reconciliation_reason text,claimed_by uuid,claimed_until timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),finished_at timestamptz
);
alter table public.fiscal_monitor_runs enable row level security;
create policy fiscal_monitor_runs_tenant_read on public.fiscal_monitor_runs for select to authenticated using(public.is_internal_user((select auth.uid()),organization_id));
grant select on public.fiscal_monitor_runs to authenticated;
create unique index fiscal_monitor_active_uidx on public.fiscal_monitor_runs(organization_id,connection_id,event_type,reconciliation) where status in('queued','processing','waiting_external');
create index fiscal_monitor_claim_idx on public.fiscal_monitor_runs(status,next_attempt_at,created_at) where status in('queued','waiting_external');

create or replace function public.claim_integra_contador_monitor_run(_owner uuid,_lease_seconds integer default 60)
returns setof public.fiscal_monitor_runs language plpgsql security definer set search_path=public as $$
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'forbidden' using errcode='42501'; end if;
 return query update public.fiscal_monitor_runs set status='processing',claimed_by=_owner,claimed_until=now()+make_interval(secs=>_lease_seconds),attempt_count=attempt_count+1,updated_at=now()
 where id=(select id from public.fiscal_monitor_runs where status in('queued','waiting_external') and coalesce(next_attempt_at,now())<=now() and (claimed_until is null or claimed_until<now()) order by created_at for update skip locked limit 1)
 returning *;
end $$;
revoke all on function public.claim_integra_contador_monitor_run(uuid,integer) from public,anon,authenticated;
grant execute on function public.claim_integra_contador_monitor_run(uuid,integer) to service_role;

create or replace function public.ensure_integra_contador_monitor_runs(_reconciliation boolean default false,_reason text default null)
returns integer language plpgsql security definer set search_path=public as $$ declare n integer; begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'forbidden' using errcode='42501'; end if;
 insert into public.fiscal_monitor_runs(organization_id,connection_id,event_type,reconciliation,reconciliation_reason)
 select c.organization_id,c.id,'caixa_postal.new_message_indicator',_reconciliation,case when _reconciliation then coalesce(_reason,'scheduled_reconciliation') end
 from public.integra_contador_connections c join public.organization_settings s on s.organization_id=c.organization_id
 where c.status='active' and coalesce((s.feature_flags->>'integra_contador')::boolean,false)
 on conflict do nothing; get diagnostics n=row_count; return n;
end $$;
revoke all on function public.ensure_integra_contador_monitor_runs(boolean,text) from public,anon,authenticated;
grant execute on function public.ensure_integra_contador_monitor_runs(boolean,text) to service_role;

create or replace function public.apply_integra_contador_monitor_events(_monitor_run_id uuid,_events jsonb,_quota_remaining integer,_next_attempt_at timestamptz)
returns integer language plpgsql security definer set search_path=public,pgmq as $$
declare _monitor public.fiscal_monitor_runs%rowtype;_event jsonb;_sync_id uuid;_count integer:=0;_fingerprint text;
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'forbidden' using errcode='42501';end if;
 select * into _monitor from public.fiscal_monitor_runs where id=_monitor_run_id and status='processing' for update;
 if _monitor.id is null then return 0;end if;
 for _event in select value from jsonb_array_elements(coalesce(_events,'[]'::jsonb)) loop
  if not exists(select 1 from public.clients where id=(_event->>'clientId')::uuid and organization_id=_monitor.organization_id) then continue;end if;
  _fingerprint:=_event->>'fingerprint';
  insert into public.receita_event_states(organization_id,client_id,connection_id,taxpayer_tax_id,event_type,remote_updated_at,last_checked_at,status,event_fingerprint,reconciliation_reason)
   select _monitor.organization_id,c.id,_monitor.connection_id,c.cnpj,_monitor.event_type,(_event->>'updatedAt')::timestamptz,now(),'queued',_fingerprint,case when _monitor.reconciliation then coalesce(_monitor.reconciliation_reason,'scheduled_reconciliation') end
   from public.clients c where c.id=(_event->>'clientId')::uuid and c.cnpj~'^\d{14}$'
   on conflict(organization_id,event_type,event_fingerprint) where event_fingerprint is not null do nothing;
  if not found then continue;end if;
  begin
   insert into public.fiscal_sync_runs(organization_id,client_id,connection_id,capability_key,reason,status,source,correlation_id,request_fingerprint)
   values(_monitor.organization_id,(_event->>'clientId')::uuid,_monitor.connection_id,_monitor.event_type,case when _monitor.reconciliation then 'scheduled_reconciliation' else 'monitor_event' end,'queued','receita_monitor',gen_random_uuid(),encode(extensions.digest((_monitor.organization_id::text||':'||(_event->>'clientId')||':'||_monitor.event_type)::bytea,'sha256'),'hex')) returning id into _sync_id;
   perform pgmq.send('fiscal-sync',jsonb_build_object('jobId',_sync_id,'organizationId',_monitor.organization_id,'clientId',_event->>'clientId','capabilityKey',_monitor.event_type,'correlationId',(select correlation_id from public.fiscal_sync_runs where id=_sync_id)));_count:=_count+1;
  exception when unique_violation then null;end;
 end loop;
 update public.fiscal_monitor_runs set status=case when _quota_remaining<=0 then 'quota_exhausted' else 'completed' end,quota_remaining=_quota_remaining,changed_count=_count,batch_size=jsonb_array_length(coalesce(_events,'[]'::jsonb)),next_attempt_at=_next_attempt_at,finished_at=now(),claimed_by=null,claimed_until=null,updated_at=now() where id=_monitor.id;
 return _count;
end $$;
revoke all on function public.apply_integra_contador_monitor_events(uuid,jsonb,integer,timestamptz) from public,anon,authenticated;
grant execute on function public.apply_integra_contador_monitor_events(uuid,jsonb,integer,timestamptz) to service_role;
