create extension if not exists pgmq;

create index integra_connections_org_status_idx on public.integra_contador_connections (organization_id, status);
create index integra_connections_expiry_idx on public.integra_contador_connections (certificate_expires_at) where status = 'active';
create index fiscal_procurations_client_idx on public.fiscal_procurations (client_id);
create index fiscal_procurations_connection_idx on public.fiscal_procurations (connection_id);
create index fiscal_procurations_status_idx on public.fiscal_procurations (organization_id, status, valid_until);
create unique index fiscal_sync_runs_active_uidx on public.fiscal_sync_runs (organization_id, client_id, capability_key, request_fingerprint) where status in ('queued','processing','waiting_external');
create index fiscal_sync_runs_queue_idx on public.fiscal_sync_runs (status, next_attempt_at, created_at) where status in ('queued','processing','waiting_external');
create index fiscal_sync_runs_org_list_idx on public.fiscal_sync_runs (organization_id, created_at desc, id desc);
create index fiscal_sync_runs_client_idx on public.fiscal_sync_runs (organization_id, client_id, created_at desc);
create index fiscal_operations_client_idx on public.fiscal_operations (organization_id, client_id, operation, period_key);
create index fiscal_cache_lookup_idx on public.fiscal_request_cache (organization_id, client_id, capability_key, valid_until desc);
create index receita_events_monitor_idx on public.receita_event_states (organization_id, status, remote_updated_at);
create index receita_events_client_idx on public.receita_event_states (client_id);
create index serpro_usage_org_idx on public.serpro_api_usage (organization_id, created_at desc);
create index serpro_usage_capability_idx on public.serpro_api_usage (organization_id, capability_key, created_at desc);
create index serpro_usage_errors_idx on public.serpro_api_usage (organization_id, http_status, created_at desc) where success = false;
create unique index fiscal_documents_external_uidx on public.fiscal_documents (organization_id, client_id, source, external_reference) where external_reference is not null;
create unique index fiscal_documents_hash_uidx on public.fiscal_documents (organization_id, client_id, content_hash) where content_hash is not null;
create index fiscal_documents_client_idx on public.fiscal_documents (organization_id, client_id, period_key, document_type);
create unique index fiscal_reviews_open_uidx on public.fiscal_reviews (organization_id, client_id, issue_fingerprint) where status in ('open','in_review');
create index fiscal_reviews_queue_idx on public.fiscal_reviews (organization_id, status, created_at);

create or replace function private.transition_fiscal_sync_run(_run_id uuid, _expected text, _next text, _error_code text default null)
returns boolean language plpgsql security definer set search_path = '' as $$ begin
  update public.fiscal_sync_runs set status=_next, error_code=_error_code, updated_at=now(),
    started_at=case when _next='processing' then coalesce(started_at,now()) else started_at end,
    finished_at=case when _next in ('completed','failed','requires_action','cancelled') then now() else finished_at end
  where id=_run_id and status=_expected;
  return found;
end $$;
revoke all on function private.transition_fiscal_sync_run(uuid,text,text,text) from public, anon, authenticated;

create or replace function private.claim_integra_token_refresh(_connection_id uuid, _owner uuid, _lease_seconds integer default 30)
returns bigint language plpgsql security definer set search_path = '' as $$ declare v bigint; begin
  insert into private.integra_contador_token_cache(connection_id,refresh_owner,refresh_locked_until,version)
  values (_connection_id,_owner,now()+make_interval(secs=>_lease_seconds),1)
  on conflict(connection_id) do update set refresh_owner=excluded.refresh_owner, refresh_locked_until=excluded.refresh_locked_until,
    version=private.integra_contador_token_cache.version+1, updated_at=now()
  where private.integra_contador_token_cache.refresh_locked_until is null or private.integra_contador_token_cache.refresh_locked_until < now()
  returning version into v; return v;
end $$;
revoke all on function private.claim_integra_token_refresh(uuid,uuid,integer) from public, anon, authenticated;

create or replace function private.store_integra_tokens(_connection_id uuid,_owner uuid,_version bigint,_access text,_jwt text,_expires_at timestamptz)
returns boolean language plpgsql security definer set search_path='' as $$ begin
  update private.integra_contador_token_cache set access_token_ciphertext=_access,jwt_token_ciphertext=_jwt,expires_at=_expires_at,
    refresh_owner=null,refresh_locked_until=null,refreshed_at=now(),updated_at=now()
  where connection_id=_connection_id and refresh_owner=_owner and version=_version;
  return found;
end $$;
revoke all on function private.store_integra_tokens(uuid,uuid,bigint,text,text,timestamptz) from public, anon, authenticated;

select pgmq.create('fiscal-sync');
select pgmq.create('fiscal-monitor');

create or replace function private.fiscal_queue_send(_queue text, _message jsonb)
returns bigint language plpgsql security definer set search_path='' as $$ begin
  if _queue not in ('fiscal-sync','fiscal-monitor') then raise exception 'invalid fiscal queue'; end if;
  if _message ?| array['token','secret','password','certificate','taxpayerTaxId','cpf','cnpj'] then raise exception 'unsafe fiscal queue payload'; end if;
  return pgmq.send(_queue,_message);
end $$;
create or replace function private.fiscal_queue_archive(_queue text,_message_id bigint)
returns boolean language plpgsql security definer set search_path='' as $$ begin
  if _queue not in ('fiscal-sync','fiscal-monitor') then raise exception 'invalid fiscal queue'; end if;
  return pgmq.archive(_queue,_message_id);
end $$;
revoke all on function private.fiscal_queue_send(text,jsonb) from public,anon,authenticated;
revoke all on function private.fiscal_queue_archive(text,bigint) from public,anon,authenticated;
