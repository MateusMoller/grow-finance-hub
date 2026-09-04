create or replace function public.sync_defis_annual_pgdas_values(
  _organization_id uuid,
  _dossier_id uuid
) returns public.simple_national_dossiers
language plpgsql
security definer
set search_path = public
as $$
declare
  _dossier public.simple_national_dossiers;
  _months jsonb;
  _months_complete integer;
  _annual_revenue numeric;
  _next_input jsonb;
  _validation jsonb;
  _next_status text;
  _old_status text;
begin
  if auth.uid() is null or not public.is_internal_user(auth.uid(), _organization_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into _dossier
  from public.simple_national_dossiers
  where id = _dossier_id
    and organization_id = _organization_id
    and obligation_kind = 'defis'
  for update;

  if not found then raise exception 'dossier_not_available'; end if;
  _old_status := _dossier.status;
  if _dossier.status in ('transmitting','transmitted','documents_issued','published','completed') then
    raise exception 'dossier_locked';
  end if;

  select
    coalesce(jsonb_agg(jsonb_build_object(
      'reference_month', to_char(months.reference_month, 'YYYY-MM'),
      'gross_revenue', months.gross_revenue,
      'source', months.gross_revenue_source
    ) order by months.reference_month), '[]'::jsonb),
    count(*) filter (where months.gross_revenue is not null),
    coalesce(sum(months.gross_revenue), 0)
  into _months, _months_complete, _annual_revenue
  from public.client_monthly_values months
  where months.organization_id = _organization_id
    and months.client_id = _dossier.client_id
    and months.reference_month >= make_date(_dossier.competence_key::integer, 1, 1)
    and months.reference_month < make_date(_dossier.competence_key::integer + 1, 1, 1);

  _next_input := coalesce(_dossier.input_data, '{}'::jsonb) || jsonb_build_object(
    'annual_revenue', _annual_revenue,
    'pgdas_monthly_revenues', _months,
    'pgdas_months_complete', _months_complete,
    'pgdas_annual_sync_at', now()
  );
  _validation := public.validate_simple_national_payload(
    'defis', _dossier.competence_key, _next_input,
    coalesce(_dossier.source_manifest, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'type', 'pgdasd_annual_consolidation',
      'reference', 'Receitas mensais do PGDAS-D armazenadas no sistema'
    ))
  );

  if _months_complete < 12 then
    _validation := jsonb_set(
      jsonb_set(_validation, '{valid}', 'false'::jsonb),
      '{blocking}',
      coalesce(_validation->'blocking', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
        'code', 'defis_pgdas_months_incomplete',
        'message', format('A consolidação anual possui %s de 12 competências do PGDAS-D.', _months_complete)
      ))
    );
  end if;
  _next_status := case when (_validation->>'valid')::boolean then 'ready_for_review' else 'validation_failed' end;

  update public.simple_national_dossiers
  set input_data = _next_input,
      source_manifest = coalesce(source_manifest, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
        'type', 'pgdasd_annual_consolidation',
        'reference', 'Receitas mensais do PGDAS-D armazenadas no sistema'
      )),
      validation_summary = _validation,
      status = _next_status,
      data_version = data_version + 1,
      approved_by = null,
      approved_at = null,
      approved_data_version = null,
      updated_by = auth.uid(),
      updated_at = now()
  where id = _dossier_id
  returning * into _dossier;

  insert into public.simple_national_dossier_events(
    organization_id, dossier_id, event_type, from_status, to_status, data_version, metadata, created_by
  ) values (
    _organization_id, _dossier_id, 'defis_pgdas_annual_values_synced', _old_status,
    _next_status, _dossier.data_version,
    jsonb_build_object('months_complete', _months_complete, 'annual_revenue', _annual_revenue), auth.uid()
  );
  perform public.record_operational_audit_log(
    _organization_id, 'simples_nacional.defis_pgdas_values_synced', 'simple_national_dossier',
    _dossier_id, _dossier.client_id,
    case when _months_complete = 12 then 'success' else 'requires_action' end,
    jsonb_build_object('months_complete', _months_complete, 'annual_revenue', _annual_revenue), null
  );
  return _dossier;
end;
$$;

revoke all on function public.sync_defis_annual_pgdas_values(uuid, uuid) from public, anon;
grant execute on function public.sync_defis_annual_pgdas_values(uuid, uuid) to authenticated;

comment on function public.sync_defis_annual_pgdas_values(uuid, uuid) is
  'Consolida as 12 competências do PGDAS-D no dossiê anual da DEFIS e bloqueia a revisão quando houver lacunas.';
