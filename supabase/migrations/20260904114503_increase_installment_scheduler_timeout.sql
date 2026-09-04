create or replace function private.invoke_integra_contador_installments(_mode text)
returns bigint language plpgsql security definer set search_path='' as $$
declare _url text; _secret text; _service_key text;
begin
  if _mode not in ('active','discovery') then raise exception 'invalid mode'; end if;
  select decrypted_secret into _url from vault.decrypted_secrets where name='integra_contador_internal_base_url' limit 1;
  select decrypted_secret into _secret from vault.decrypted_secrets where name='integra_contador_internal_worker_secret' limit 1;
  select decrypted_secret into _service_key from vault.decrypted_secrets where name='integra_contador_internal_service_role_key' limit 1;
  if _url is null or _secret is null or _service_key is null then return null; end if;
  return net.http_post(
    url:=_url||'/functions/v1/integra-contador-installments',
    body:=jsonb_build_object('action','scheduled_sync','mode',_mode),
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||_service_key,'x-worker-token',_secret),
    timeout_milliseconds:=120000
  );
end $$;
revoke all on function private.invoke_integra_contador_installments(text) from public,anon,authenticated;
