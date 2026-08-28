create table public.caixa_postal_indicators (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  sync_run_id uuid references public.fiscal_sync_runs(id) on delete set null,
  has_new_messages boolean not null,
  indicator_code text,
  source_updated_at timestamptz,
  fetched_at timestamptz not null default now(),
  stale_after timestamptz not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (organization_id, client_id)
);
alter table public.caixa_postal_indicators enable row level security;
create policy caixa_postal_indicators_tenant_read on public.caixa_postal_indicators
  for select to authenticated using (public.is_internal_user((select auth.uid()), organization_id));
grant select on public.caixa_postal_indicators to authenticated;
create index caixa_postal_indicators_client_idx on public.caixa_postal_indicators (organization_id, client_id, fetched_at desc);
create index fiscal_cache_active_idx on public.fiscal_request_cache (organization_id, client_id, capability_key, valid_until)
  where capability_key = 'caixa_postal.new_message_indicator';

create or replace function public.enqueue_caixa_postal_indicator_sync(
  _organization_id uuid, _client_id uuid, _force_refresh boolean default false
) returns jsonb
language plpgsql security definer set search_path = public, pgmq
as $$
declare _connection public.integra_contador_connections%rowtype; _run_id uuid; _fingerprint text;
  _cached public.fiscal_request_cache%rowtype; _correlation uuid := gen_random_uuid();
begin
  if auth.uid() is null or not public.is_internal_user(auth.uid(), _organization_id) then raise exception 'forbidden' using errcode='42501'; end if;
  if not exists(select 1 from public.clients where id=_client_id and organization_id=_organization_id) then raise exception 'client_not_available' using errcode='P0002'; end if;
  select * into _connection from public.integra_contador_connections where organization_id=_organization_id and status='active' order by updated_at desc limit 1;
  if _connection.id is null then raise exception 'connection_not_ready' using errcode='P0001'; end if;
  _fingerprint := encode(extensions.digest((_organization_id::text||':'||_client_id::text||':caixa_postal.new_message_indicator')::bytea,'sha256'),'hex');
  if not _force_refresh then
    select * into _cached from public.fiscal_request_cache where organization_id=_organization_id and client_id=_client_id
      and capability_key='caixa_postal.new_message_indicator' and request_fingerprint=_fingerprint and valid_until>now() limit 1;
    if _cached.id is not null then return jsonb_build_object('status','completed','cacheHit',true,'result',_cached.normalized_result,'validUntil',_cached.valid_until); end if;
  end if;
  select id into _run_id from public.fiscal_sync_runs where organization_id=_organization_id and client_id=_client_id
    and capability_key='caixa_postal.new_message_indicator' and request_fingerprint=_fingerprint and status in ('queued','processing','waiting_external') limit 1;
  if _run_id is not null then return jsonb_build_object('syncRunId',_run_id,'status','queued','cacheHit',false,'duplicate',true); end if;
  insert into public.fiscal_sync_runs(organization_id,client_id,connection_id,capability_key,reason,status,requested_by,source,correlation_id,request_fingerprint)
    values(_organization_id,_client_id,_connection.id,'caixa_postal.new_message_indicator','user_request','queued',auth.uid(),'internal_api',_correlation,_fingerprint)
    returning id into _run_id;
  perform pgmq.send('fiscal-sync',jsonb_build_object('jobId',_run_id,'organizationId',_organization_id,'clientId',_client_id,'capabilityKey','caixa_postal.new_message_indicator','correlationId',_correlation));
  return jsonb_build_object('syncRunId',_run_id,'status','queued','cacheHit',false,'correlationId',_correlation);
end $$;

create or replace function public.get_client_fiscal_status(_organization_id uuid, _client_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare _indicator public.caixa_postal_indicators%rowtype; _run public.fiscal_sync_runs%rowtype;
begin
  if auth.uid() is null or not public.is_internal_user(auth.uid(),_organization_id) then raise exception 'forbidden' using errcode='42501'; end if;
  if not exists(select 1 from public.clients where id=_client_id and organization_id=_organization_id) then raise exception 'client_not_available' using errcode='P0002'; end if;
  select * into _indicator from public.caixa_postal_indicators where organization_id=_organization_id and client_id=_client_id;
  select * into _run from public.fiscal_sync_runs where organization_id=_organization_id and client_id=_client_id and capability_key='caixa_postal.new_message_indicator' order by created_at desc limit 1;
  return jsonb_build_object('indicator',case when _indicator.id is null then null else jsonb_build_object('hasNewMessages',_indicator.has_new_messages,'indicatorCode',_indicator.indicator_code,'sourceUpdatedAt',_indicator.source_updated_at,'fetchedAt',_indicator.fetched_at,'stale',_indicator.stale_after<=now()) end,
    'run',case when _run.id is null then null else jsonb_build_object('id',_run.id,'status',_run.status,'nextAttemptAt',_run.next_attempt_at,'errorCode',_run.error_code,'createdAt',_run.created_at) end,
    'allowedActions',jsonb_build_array('sync'));
end $$;

create or replace function public.complete_caixa_postal_indicator_sync(_run_id uuid,_has_new_messages boolean,_indicator_code text,_source_updated_at timestamptz)
returns boolean language plpgsql security definer set search_path=public as $$
declare _run public.fiscal_sync_runs%rowtype;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then raise exception 'forbidden' using errcode='42501'; end if;
  select * into _run from public.fiscal_sync_runs where id=_run_id for update;
  if _run.status <> 'processing' then return false; end if;
  insert into public.caixa_postal_indicators(organization_id,client_id,sync_run_id,has_new_messages,indicator_code,source_updated_at,stale_after)
    values(_run.organization_id,_run.client_id,_run.id,_has_new_messages,_indicator_code,_source_updated_at,now()+interval '20 minutes')
    on conflict(organization_id,client_id) do update set sync_run_id=excluded.sync_run_id,has_new_messages=excluded.has_new_messages,indicator_code=excluded.indicator_code,source_updated_at=excluded.source_updated_at,fetched_at=now(),stale_after=excluded.stale_after,updated_at=now();
  insert into public.fiscal_request_cache(organization_id,client_id,capability_key,request_fingerprint,cache_category,normalized_result,result_hash,fetched_at,valid_until)
    values(_run.organization_id,_run.client_id,_run.capability_key,_run.request_fingerprint,'real_time',jsonb_build_object('hasNewMessages',_has_new_messages,'indicatorCode',_indicator_code,'sourceUpdatedAt',_source_updated_at),encode(extensions.digest((_has_new_messages::text||coalesce(_indicator_code,''))::bytea,'sha256'),'hex'),now(),now()+interval '20 minutes')
    on conflict(organization_id,client_id,capability_key,request_fingerprint) do update set normalized_result=excluded.normalized_result,result_hash=excluded.result_hash,fetched_at=now(),valid_until=excluded.valid_until,updated_at=now();
  update public.fiscal_sync_runs set status='completed',records_received=1,records_changed=1,finished_at=now(),updated_at=now() where id=_run.id and status='processing';
  return found;
end $$;

revoke all on function public.enqueue_caixa_postal_indicator_sync(uuid,uuid,boolean) from public,anon;
revoke all on function public.get_client_fiscal_status(uuid,uuid) from public,anon;
revoke all on function public.complete_caixa_postal_indicator_sync(uuid,boolean,text,timestamptz) from public,anon,authenticated;
grant execute on function public.enqueue_caixa_postal_indicator_sync(uuid,uuid,boolean) to authenticated;
grant execute on function public.get_client_fiscal_status(uuid,uuid) to authenticated;
grant execute on function public.complete_caixa_postal_indicator_sync(uuid,boolean,text,timestamptz) to service_role;
