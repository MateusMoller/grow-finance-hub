-- Prevent monthly competence keys from reaching the annual DEFIS workflow and
-- resolve an occurrence that was previously consolidated into its canonical row.
create or replace function public.link_simple_national_dossier_to_obligation()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  _template_id uuid;
  _profile_id uuid;
  _instance_id uuid;
  _base_date date;
  _profile_start date;
  _operational_month integer;
begin
  if (new.obligation_kind = 'pgdasd' and new.competence_key !~ '^\d{6}$')
     or (new.obligation_kind = 'defis' and new.competence_key !~ '^\d{4}$') then
    raise exception 'invalid_obligation_competence';
  end if;

  perform public.ensure_simple_national_system_templates(new.organization_id);
  select t.id,
    case when new.obligation_kind = 'defis' then coalesce(
      (select (fixed_date.value->>'month')::integer
       from jsonb_array_elements(coalesce(t.due_fixed_dates, '[]'::jsonb))
         with ordinality fixed_date(value, position)
       where (fixed_date.value->>'month')::integer between 1 and 12
       order by fixed_date.position limit 1),
      t.due_fixed_month, t.yearly_due_month, 3)
    end
  into _template_id, _operational_month
  from public.obligation_templates t
  where t.organization_id = new.organization_id
    and t.code = case new.obligation_kind when 'pgdasd' then 'pgdas_d' when 'defis' then 'defis' end
    and t.is_active
  limit 1;

  if _template_id is null then raise exception 'system_obligation_template_not_available'; end if;

  if new.obligation_kind = 'pgdasd' then
    _base_date := make_date(substr(new.competence_key, 1, 4)::integer, substr(new.competence_key, 5, 2)::integer, 1);
    _profile_start := _base_date;
  else
    _base_date := (make_date(new.competence_key::integer, _operational_month, 1) - interval '1 month')::date;
    _profile_start := make_date(new.competence_key::integer, 1, 1);
  end if;

  insert into public.client_obligation_profiles(
    organization_id, client_id, template_id, start_date, is_active, source_kind, applied_regime, created_by
  ) values (
    new.organization_id, new.client_id, _template_id, _profile_start, true,
    'automation', 'simples_nacional', coalesce(new.created_by, auth.uid())
  )
  on conflict(client_id, template_id) do update set
    start_date = least(client_obligation_profiles.start_date, excluded.start_date),
    is_active = true, end_date = null, source_kind = 'automation',
    applied_regime = 'simples_nacional', updated_at = now()
  returning id into _profile_id;

  select coalesce(canonical.id, occurrence.id) into _instance_id
  from public.obligation_instances occurrence
  left join public.obligation_instances canonical
    on canonical.id = occurrence.superseded_by_instance_id
   and canonical.organization_id = new.organization_id
  where occurrence.organization_id = new.organization_id
    and occurrence.client_id = new.client_id
    and occurrence.template_id = _template_id
    and ((new.obligation_kind = 'pgdasd' and regexp_replace(occurrence.competence_key, '[^0-9]', '', 'g') = new.competence_key)
      or (new.obligation_kind = 'defis' and extract(year from occurrence.competence_date)::text = new.competence_key))
  order by (occurrence.superseded_by_instance_id is null) desc, occurrence.created_at desc
  limit 1;

  if _instance_id is null then
    perform public.generate_obligation_occurrences(
      _base_date, new.organization_id, new.client_id, coalesce(new.created_by, auth.uid()), 'manual_rpc'
    );
    select coalesce(canonical.id, occurrence.id) into _instance_id
    from public.obligation_instances occurrence
    left join public.obligation_instances canonical
      on canonical.id = occurrence.superseded_by_instance_id
     and canonical.organization_id = new.organization_id
    where occurrence.organization_id = new.organization_id
      and occurrence.client_id = new.client_id
      and occurrence.template_id = _template_id
      and ((new.obligation_kind = 'pgdasd' and regexp_replace(occurrence.competence_key, '[^0-9]', '', 'g') = new.competence_key)
        or (new.obligation_kind = 'defis' and extract(year from occurrence.competence_date)::text = new.competence_key))
    order by (occurrence.superseded_by_instance_id is null) desc, occurrence.created_at desc
    limit 1;
  end if;

  if new.obligation_instance_id is not null
     and new.obligation_instance_id <> coalesce(_instance_id, new.obligation_instance_id) then
    raise exception 'obligation_instance_template_mismatch';
  end if;
  if _instance_id is null then raise exception 'canonical_obligation_instance_not_generated'; end if;

  new.template_id := _template_id;
  new.obligation_instance_id := _instance_id;
  return new;
end $$;

revoke all on function public.link_simple_national_dossier_to_obligation() from public, anon, authenticated;

create or replace function public.create_simple_national_dossier(
  _organization_id uuid,
  _client_id uuid,
  _kind text,
  _competence_key text,
  _obligation_instance_id uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare _id uuid; _client public.clients%rowtype;
begin
  if auth.uid() is null or not public.is_internal_user(auth.uid(), _organization_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if _kind not in ('pgdasd', 'defis')
     or (_kind = 'pgdasd' and _competence_key !~ '^\d{6}$')
     or (_kind = 'defis' and _competence_key !~ '^\d{4}$') then
    raise exception 'invalid_obligation_competence';
  end if;
  select * into _client from public.clients
  where id = _client_id and organization_id = _organization_id and status = 'Ativo';
  if not found then raise exception 'client_not_available'; end if;
  if lower(coalesce(_client.regime,'')) not like '%simples%' then raise exception 'client_not_simples_nacional'; end if;
  if _obligation_instance_id is not null and not exists (
    select 1 from public.obligation_instances i
    where i.id = _obligation_instance_id and i.client_id = _client_id and i.organization_id = _organization_id
  ) then raise exception 'obligation_not_available'; end if;

  insert into public.simple_national_dossiers(
    organization_id, client_id, obligation_instance_id, obligation_kind, competence_key,
    input_data, created_by, updated_by
  ) values (
    _organization_id, _client_id, _obligation_instance_id, _kind, _competence_key,
    jsonb_build_object('cnpj', regexp_replace(coalesce(_client.cnpj,''), '\D', '', 'g')),
    auth.uid(), auth.uid()
  )
  on conflict (organization_id, client_id, obligation_kind, competence_key)
  do update set obligation_instance_id = coalesce(excluded.obligation_instance_id, simple_national_dossiers.obligation_instance_id),
    updated_at = now(), updated_by = auth.uid()
  returning id into _id;
  insert into public.simple_national_dossier_events(organization_id,dossier_id,event_type,to_status,data_version,created_by)
  select organization_id,id,'dossier_created',status,data_version,auth.uid()
  from public.simple_national_dossiers where id = _id;
  perform public.record_operational_audit_log(
    _organization_id,'simples_nacional.dossier_created','simple_national_dossier',_id,_client_id,
    'success',jsonb_build_object('kind',_kind,'competence',_competence_key),null
  );
  return _id;
end $$;

revoke all on function public.create_simple_national_dossier(uuid,uuid,text,text,uuid) from public, anon;
grant execute on function public.create_simple_national_dossier(uuid,uuid,text,text,uuid) to authenticated;
