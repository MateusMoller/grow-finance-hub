create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

create or replace function public.invoke_fiscal_invoice_sync()
returns void
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  sync_secret text;
begin
  select decrypted_secret
    into sync_secret
  from vault.decrypted_secrets
  where name = 'fiscal_invoice_sync_secret'
  limit 1;

  if sync_secret is null or btrim(sync_secret) = '' then
    raise notice 'fiscal_invoice_sync_secret is not configured in Supabase Vault.';
    return;
  end if;

  perform net.http_post(
    url := 'https://vgkmcerjlwnzbiukinhd.supabase.co/functions/v1/fiscal-invoices-module',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-grow-internal-secret', sync_secret
    ),
    body := jsonb_build_object(
      'action', 'scheduled_sync',
      'limit', 3
    ),
    timeout_milliseconds := 55000
  );
end;
$$;

revoke all on function public.invoke_fiscal_invoice_sync() from public, anon, authenticated;

do $$
declare
  job record;
begin
  for job in
    select jobid from cron.job where jobname = 'grow-fiscal-invoice-sync'
  loop
    perform cron.unschedule(job.jobid);
  end loop;
end $$;

select cron.schedule(
  'grow-fiscal-invoice-sync',
  '*/10 * * * *',
  $$select public.invoke_fiscal_invoice_sync();$$
);
