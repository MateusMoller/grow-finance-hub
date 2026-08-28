create or replace function public.claim_fiscal_sync_job(_visibility_seconds integer default 90)
returns jsonb
language plpgsql
security definer
set search_path = public, pgmq
as $$
declare
  _due record;
  _message record;
  _run_id uuid;
begin
  if coalesce(auth.jwt()->>'role', '') <> 'service_role' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if _visibility_seconds < 15 or _visibility_seconds > 900 then
    raise exception 'invalid_visibility';
  end if;

  for _due in
    update public.fiscal_sync_runs
       set status = 'queued', updated_at = now()
     where id in (
       select id from public.fiscal_sync_runs
        where status = 'waiting_external' and next_attempt_at <= now()
        order by next_attempt_at for update skip locked limit 100
     )
     returning id, organization_id, client_id, capability_key, correlation_id
  loop
    perform pgmq.send('fiscal-sync', jsonb_build_object(
      'jobId', _due.id, 'organizationId', _due.organization_id,
      'clientId', _due.client_id, 'capabilityKey', _due.capability_key,
      'correlationId', _due.correlation_id
    ));
  end loop;

  select * into _message from pgmq.read('fiscal-sync', _visibility_seconds, 1) limit 1;
  if _message.msg_id is null then return null; end if;
  begin
    _run_id := (_message.message->>'jobId')::uuid;
  exception when others then
    perform pgmq.archive('fiscal-sync', _message.msg_id);
    return null;
  end;

  update public.fiscal_sync_runs
     set status = 'processing', started_at = coalesce(started_at, now()),
         attempt_count = attempt_count + 1, updated_at = now()
   where id = _run_id and status = 'queued';
  if not found then
    perform pgmq.archive('fiscal-sync', _message.msg_id);
    return null;
  end if;
  return jsonb_build_object('messageId', _message.msg_id, 'runId', _run_id);
end;
$$;

create or replace function public.archive_fiscal_sync_job(_message_id bigint)
returns boolean
language plpgsql
security definer
set search_path = pgmq
as $$
begin
  if coalesce(auth.jwt()->>'role', '') <> 'service_role' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return pgmq.archive('fiscal-sync', _message_id);
end;
$$;

revoke all on function public.claim_fiscal_sync_job(integer) from public, anon, authenticated;
revoke all on function public.archive_fiscal_sync_job(bigint) from public, anon, authenticated;
grant execute on function public.claim_fiscal_sync_job(integer) to service_role;
grant execute on function public.archive_fiscal_sync_job(bigint) to service_role;

create index if not exists fiscal_sync_runs_due_wait_idx
  on public.fiscal_sync_runs(next_attempt_at, id)
  where status = 'waiting_external';

create or replace function private.cleanup_replaced_integra_contador_secrets()
returns trigger
language plpgsql
security definer
set search_path = vault, pg_temp
as $$
begin
  if old.credential_secret_ref is not null
     and (tg_op = 'DELETE' or old.credential_secret_ref is distinct from new.credential_secret_ref) then
    delete from vault.secrets where id = old.credential_secret_ref::uuid;
  end if;
  if old.certificate_secret_ref is not null
     and (tg_op = 'DELETE' or old.certificate_secret_ref is distinct from new.certificate_secret_ref) then
    delete from vault.secrets where id = old.certificate_secret_ref::uuid;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
exception when invalid_text_representation then
  raise warning 'Invalid Integra Contador secret reference for connection %', old.id;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function private.cleanup_replaced_integra_contador_secrets() from public, anon, authenticated;
drop trigger if exists cleanup_replaced_integra_contador_secrets on public.integra_contador_connections;
create trigger cleanup_replaced_integra_contador_secrets
after update of credential_secret_ref, certificate_secret_ref or delete
on public.integra_contador_connections
for each row execute function private.cleanup_replaced_integra_contador_secrets();
