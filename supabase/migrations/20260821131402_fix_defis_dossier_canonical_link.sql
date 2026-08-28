-- Link Simples Nacional dossiers to the canonical obligation occurrence using
-- the template's effective operational month. DEFIS templates may preserve an
-- earlier technical due month in due_fixed_dates, so a hard-coded March cycle
-- can legitimately generate no occurrence.
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
  perform public.ensure_simple_national_system_templates(new.organization_id);

  select
    t.id,
    case
      when new.obligation_kind = 'defis' then coalesce(
        (
          select (fixed_date.value->>'month')::integer
          from jsonb_array_elements(coalesce(t.due_fixed_dates, '[]'::jsonb))
            with ordinality fixed_date(value, position)
          where (fixed_date.value->>'month')::integer between 1 and 12
          order by fixed_date.position
          limit 1
        ),
        t.due_fixed_month,
        t.yearly_due_month,
        3
      )
      else null
    end
  into _template_id, _operational_month
  from public.obligation_templates t
  where t.organization_id = new.organization_id
    and t.code = case new.obligation_kind when 'pgdasd' then 'pgdas_d' when 'defis' then 'defis' end
    and t.is_active
  limit 1;

  if _template_id is null then
    raise exception 'system_obligation_template_not_available';
  end if;

  if new.obligation_kind = 'pgdasd' then
    _base_date := make_date(substr(new.competence_key, 1, 4)::integer, substr(new.competence_key, 5, 2)::integer, 1);
    _profile_start := _base_date;
  else
    _base_date := (make_date(substr(new.competence_key, 1, 4)::integer, _operational_month, 1) - interval '1 month')::date;
    _profile_start := make_date(substr(new.competence_key, 1, 4)::integer, 1, 1);
  end if;

  insert into public.client_obligation_profiles(
    organization_id, client_id, template_id, start_date, is_active, source_kind, applied_regime, created_by
  ) values (
    new.organization_id, new.client_id, _template_id, _profile_start, true,
    'automation', 'simples_nacional', coalesce(new.created_by, auth.uid())
  )
  on conflict(client_id, template_id) do update set
    start_date = least(client_obligation_profiles.start_date, excluded.start_date),
    is_active = true,
    end_date = null,
    source_kind = 'automation',
    applied_regime = 'simples_nacional',
    updated_at = now()
  returning id into _profile_id;

  select i.id into _instance_id
  from public.obligation_instances i
  where i.organization_id = new.organization_id
    and i.client_id = new.client_id
    and i.template_id = _template_id
    and (
      (new.obligation_kind = 'pgdasd' and regexp_replace(i.competence_key, '[^0-9]', '', 'g') = new.competence_key)
      or
      (new.obligation_kind = 'defis' and extract(year from i.competence_date)::text = new.competence_key)
    )
    and i.superseded_by_instance_id is null
  order by i.created_at desc
  limit 1;

  if _instance_id is null then
    perform public.generate_obligation_occurrences(
      _base_date,
      new.organization_id,
      new.client_id,
      coalesce(new.created_by, auth.uid()),
      'manual_rpc'
    );

    select i.id into _instance_id
    from public.obligation_instances i
    where i.organization_id = new.organization_id
      and i.client_id = new.client_id
      and i.template_id = _template_id
      and (
        (new.obligation_kind = 'pgdasd' and regexp_replace(i.competence_key, '[^0-9]', '', 'g') = new.competence_key)
        or
        (new.obligation_kind = 'defis' and extract(year from i.competence_date)::text = new.competence_key)
      )
      and i.superseded_by_instance_id is null
    order by i.created_at desc
    limit 1;
  end if;

  if new.obligation_instance_id is not null
     and new.obligation_instance_id <> coalesce(_instance_id, new.obligation_instance_id) then
    raise exception 'obligation_instance_template_mismatch';
  end if;
  if _instance_id is null then
    raise exception 'canonical_obligation_instance_not_generated';
  end if;

  new.template_id := _template_id;
  new.obligation_instance_id := _instance_id;
  return new;
end $$;

revoke all on function public.link_simple_national_dossier_to_obligation() from public, anon, authenticated;
