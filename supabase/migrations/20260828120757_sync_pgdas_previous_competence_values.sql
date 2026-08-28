alter table public.client_monthly_values
  add column if not exists gross_revenue_source text,
  add column if not exists payroll_source text,
  add column if not exists source_metadata jsonb not null default '{}'::jsonb;

create or replace function public.sync_pgdas_previous_competence_values(
  _organization_id uuid,
  _dossier_id uuid,
  _reference_month date,
  _gross_revenue numeric,
  _source_declaration_id text default null,
  _source_artifact_path text default null
)
returns public.simple_national_dossiers
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  _dossier public.simple_national_dossiers;
  _monthly public.client_monthly_values;
  _period_start date;
  _prior_revenues jsonb;
  _payroll_history jsonb;
  _months_with_revenue integer;
  _months_with_payroll integer;
begin
  if _gross_revenue is null or _gross_revenue < 0 then
    raise exception 'invalid_gross_revenue';
  end if;

  select * into _dossier
  from public.simple_national_dossiers
  where id = _dossier_id
    and organization_id = _organization_id
    and obligation_kind = 'pgdasd'
  for update;

  if _dossier.id is null then
    raise exception 'dossier_not_available';
  end if;

  if _reference_month <> (to_date(_dossier.competence_key || '01', 'YYYYMMDD') - interval '1 month')::date then
    raise exception 'previous_competence_mismatch';
  end if;

  insert into public.client_monthly_values (
    organization_id,
    client_id,
    reference_month,
    gross_revenue,
    gross_revenue_source,
    source_metadata
  ) values (
    _organization_id,
    _dossier.client_id,
    _reference_month,
    _gross_revenue,
    'pgdasd_serpro_previous_extract',
    jsonb_strip_nulls(jsonb_build_object(
      'declaration_id', _source_declaration_id,
      'artifact_path', _source_artifact_path,
      'synced_at', now()
    ))
  )
  on conflict (organization_id, client_id, reference_month)
  do update set
    gross_revenue = excluded.gross_revenue,
    gross_revenue_source = excluded.gross_revenue_source,
    source_metadata = public.client_monthly_values.source_metadata || excluded.source_metadata,
    updated_at = now()
  returning * into _monthly;

  _period_start := (_reference_month - interval '11 months')::date;

  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'pa', to_char(reference_month, 'YYYYMM')::integer,
        'valorInterno', gross_revenue,
        'valorExterno', 0
      ) order by reference_month
    ) filter (where gross_revenue is not null), '[]'::jsonb),
    coalesce(jsonb_agg(
      jsonb_build_object(
        'pa', to_char(reference_month, 'YYYYMM')::integer,
        'valor', payroll_with_charges
      ) order by reference_month
    ) filter (where payroll_with_charges is not null), '[]'::jsonb),
    count(*) filter (where gross_revenue is not null)::integer,
    count(*) filter (where payroll_with_charges is not null)::integer
  into _prior_revenues, _payroll_history, _months_with_revenue, _months_with_payroll
  from public.client_monthly_values
  where organization_id = _organization_id
    and client_id = _dossier.client_id
    and reference_month between _period_start and _reference_month;

  update public.simple_national_dossiers
  set input_data = input_data || jsonb_build_object(
        'prior_revenues', _prior_revenues,
        'payroll_history', _payroll_history,
        'payroll_r12', (
          select coalesce(sum(payroll_with_charges), 0)
          from public.client_monthly_values
          where organization_id = _organization_id
            and client_id = _dossier.client_id
            and reference_month between _period_start and _reference_month
        ),
        'previous_competence_values', jsonb_strip_nulls(jsonb_build_object(
          'reference_month', to_char(_reference_month, 'YYYY-MM'),
          'gross_revenue', _gross_revenue,
          'gross_revenue_source', 'pgdasd_serpro_previous_extract',
          'payroll_with_charges', _monthly.payroll_with_charges,
          'payroll_source', _monthly.payroll_source,
          'relation_status', case when _monthly.payroll_with_charges is null then 'payroll_missing' else 'linked' end,
          'months_with_revenue', _months_with_revenue,
          'months_with_payroll', _months_with_payroll,
          'declaration_id', _source_declaration_id
        ))
      ),
      data_version = data_version + 1,
      updated_at = now()
  where id = _dossier.id
  returning * into _dossier;

  return _dossier;
end;
$$;

revoke all on function public.sync_pgdas_previous_competence_values(uuid, uuid, date, numeric, text, text) from public, anon;
grant execute on function public.sync_pgdas_previous_competence_values(uuid, uuid, date, numeric, text, text) to authenticated;

comment on function public.sync_pgdas_previous_competence_values(uuid, uuid, date, numeric, text, text) is
  'Relaciona a receita do extrato PGDAS-D anterior com a folha da mesma competência e atualiza o histórico usado na operação atual.';
