create or replace function private.cleanup_integra_contador_retention(_now timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  _cache_deleted integer := 0;
  _usage_deleted integer := 0;
  _runs_redacted integer := 0;
  _operations_redacted integer := 0;
begin
  delete from public.fiscal_request_cache
   where valid_until < _now - interval '7 days';
  get diagnostics _cache_deleted = row_count;

  delete from public.serpro_api_usage
   where created_at < _now - interval '395 days';
  get diagnostics _usage_deleted = row_count;

  update public.fiscal_sync_runs
     set external_protocol = null,
         error_summary = case when error_summary is null then null else '[redacted by retention policy]' end,
         updated_at = _now
   where status in ('completed','failed','requires_action','cancelled')
     and coalesce(finished_at, updated_at, created_at) < _now - interval '180 days'
     and (external_protocol is not null or (error_summary is not null and error_summary <> '[redacted by retention policy]'));
  get diagnostics _runs_redacted = row_count;

  update public.fiscal_operations
     set external_reference = null,
         updated_at = _now
   where status in ('completed','failed','requires_action')
     and updated_at < _now - interval '180 days'
     and external_reference is not null;
  get diagnostics _operations_redacted = row_count;

  return jsonb_build_object(
    'cacheDeleted', _cache_deleted,
    'usageDeleted', _usage_deleted,
    'runsRedacted', _runs_redacted,
    'operationsRedacted', _operations_redacted
  );
end;
$$;

comment on function private.cleanup_integra_contador_retention(timestamptz) is
  'Daily data-minimization cleanup. Raw provider payloads are never persisted; cache expires after a 7-day grace period, detailed usage after 395 days, and provider references/error summaries after 180 days.';

revoke all on function private.cleanup_integra_contador_retention(timestamptz) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'integra-contador-retention') then
    perform cron.unschedule('integra-contador-retention');
  end if;
  perform cron.schedule(
    'integra-contador-retention',
    '17 3 * * *',
    $cron$select private.cleanup_integra_contador_retention();$cron$
  );
end;
$$;
