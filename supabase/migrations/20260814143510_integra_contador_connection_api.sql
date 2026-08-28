alter table public.integra_contador_connections
  add column if not exists certificate_filename text,
  add column if not exists certificate_fingerprint text,
  add column if not exists configured_at timestamptz,
  add column if not exists validation_attempts integer not null default 0;

create or replace function public.get_integra_contador_connection_status(_organization_id uuid)
returns table (
  id uuid, environment text, contractor_tax_id text, status text,
  certificate_filename text, certificate_fingerprint text,
  certificate_expires_at timestamptz, configured_at timestamptz,
  enabled_capabilities text[], last_health_check_at timestamptz,
  last_success_at timestamptz, last_error_code text, updated_at timestamptz
)
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_internal_user(auth.uid(), _organization_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select c.id, c.environment, c.contractor_tax_id, c.status,
      c.certificate_filename, c.certificate_fingerprint,
      c.certificate_expires_at, c.configured_at, c.enabled_capabilities,
      c.last_health_check_at, c.last_success_at, c.last_error_code, c.updated_at
    from public.integra_contador_connections c
    where c.organization_id = _organization_id
    order by c.updated_at desc limit 1;
end;
$$;

create or replace function public.configure_integra_contador_connection(
  _organization_id uuid, _environment text, _contractor_tax_id text,
  _consumer_key text, _consumer_secret text, _certificate_base64 text,
  _certificate_password text, _certificate_filename text, _certificate_fingerprint text
) returns uuid
language plpgsql security definer set search_path = public, vault
as $$
declare
  _connection_id uuid;
  _credential_ref uuid;
  _certificate_ref uuid;
begin
  if not public.is_permission_admin(_organization_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if _environment not in ('development','validation','production')
    or _contractor_tax_id !~ '^\d{14}$'
    or nullif(_consumer_key, '') is null or nullif(_consumer_secret, '') is null
    or nullif(_certificate_base64, '') is null or nullif(_certificate_password, '') is null then
    raise exception 'invalid_request' using errcode = '22023';
  end if;

  _credential_ref := vault.create_secret(
    jsonb_build_object('consumerKey', _consumer_key, 'consumerSecret', _consumer_secret)::text,
    'integra-contador-credentials-' || _organization_id || '-' || gen_random_uuid(),
    'Integra Contador OAuth credentials'
  );
  _certificate_ref := vault.create_secret(
    jsonb_build_object('p12Base64', _certificate_base64, 'password', _certificate_password)::text,
    'integra-contador-certificate-' || _organization_id || '-' || gen_random_uuid(),
    'Integra Contador client certificate'
  );

  insert into public.integra_contador_connections (
    organization_id, environment, contractor_tax_id, status,
    credential_secret_ref, certificate_secret_ref, certificate_filename,
    certificate_fingerprint, configured_at, created_by, updated_by
  ) values (
    _organization_id, _environment, _contractor_tax_id, 'pending',
    _credential_ref::text, _certificate_ref::text, left(_certificate_filename, 255),
    _certificate_fingerprint, now(), auth.uid(), auth.uid()
  ) on conflict (organization_id, environment) do update set
    contractor_tax_id = excluded.contractor_tax_id,
    status = 'pending', credential_secret_ref = excluded.credential_secret_ref,
    certificate_secret_ref = excluded.certificate_secret_ref,
    certificate_filename = excluded.certificate_filename,
    certificate_fingerprint = excluded.certificate_fingerprint,
    configured_at = now(), last_error_code = null, updated_by = auth.uid(), updated_at = now()
  returning public.integra_contador_connections.id into _connection_id;

  perform public.record_operational_audit_log(
    _organization_id, 'integra_contador.connection_configured',
    'integra_contador_connection', _connection_id, null, 'success',
    jsonb_build_object('environment', _environment, 'certificateFingerprint', _certificate_fingerprint), null
  );
  return _connection_id;
end;
$$;

create or replace function public.record_integra_contador_connection_validation(
  _organization_id uuid, _connection_id uuid, _status text, _error_code text default null
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_permission_admin(_organization_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if _status not in ('active','requires_action','failed') then
    raise exception 'invalid_request' using errcode = '22023';
  end if;
  update public.integra_contador_connections
  set status = _status, last_health_check_at = now(),
      last_success_at = case when _status = 'active' then now() else last_success_at end,
      last_error_code = _error_code, validation_attempts = validation_attempts + 1,
      updated_by = auth.uid(), updated_at = now()
  where id = _connection_id and organization_id = _organization_id;
  if not found then raise exception 'organization_not_available' using errcode = 'P0002'; end if;
  perform public.record_operational_audit_log(
    _organization_id, 'integra_contador.connection_validated',
    'integra_contador_connection', _connection_id, null,
    case when _status = 'active' then 'success' else 'failure' end,
    jsonb_build_object('status', _status, 'errorCode', _error_code), null
  );
end;
$$;

revoke all on function public.get_integra_contador_connection_status(uuid) from public, anon;
revoke all on function public.configure_integra_contador_connection(uuid,text,text,text,text,text,text,text,text) from public, anon;
revoke all on function public.record_integra_contador_connection_validation(uuid,uuid,text,text) from public, anon;
grant execute on function public.get_integra_contador_connection_status(uuid) to authenticated;
grant execute on function public.configure_integra_contador_connection(uuid,text,text,text,text,text,text,text,text) to authenticated;
grant execute on function public.record_integra_contador_connection_validation(uuid,uuid,text,text) to authenticated;
