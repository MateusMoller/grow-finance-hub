create or replace function private.enforce_pgdas_factor_r_gate()
returns trigger
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $$
declare
  _is_pgdas boolean;
  _is_factor_r boolean;
  _period_start date;
  _period_end date;
  _months_complete integer;
  _payroll_fs12 numeric;
  _revenue_rbt12 numeric;
  _factor_r numeric;
begin
  if new.status not in ('pronto_para_envio', 'enviando', 'concluida') then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  select lower(t.code) = 'pgdas_d' or lower(coalesce(t.normalized_name, t.name, '')) like '%pgdas%'
  into _is_pgdas
  from public.obligation_templates t
  where t.id = new.template_id and t.organization_id = new.organization_id;

  if not coalesce(_is_pgdas, false) then
    return new;
  end if;

  select c.is_factor_r
  into _is_factor_r
  from public.clients c
  where c.id = new.client_id and c.organization_id = new.organization_id;

  if not coalesce(_is_factor_r, false) then
    return new;
  end if;

  _period_start := (date_trunc('month', new.competence_date)::date - interval '12 months')::date;
  _period_end := (date_trunc('month', new.competence_date)::date - interval '1 month')::date;

  select
    count(*) filter (where v.payroll_with_charges is not null and v.gross_revenue is not null)::integer,
    coalesce(sum(v.payroll_with_charges), 0),
    coalesce(sum(v.gross_revenue), 0)
  into _months_complete, _payroll_fs12, _revenue_rbt12
  from public.client_monthly_values v
  where v.organization_id = new.organization_id
    and v.client_id = new.client_id
    and v.reference_month between _period_start and _period_end;

  if _months_complete < 12 then
    raise exception using
      errcode = 'P0001',
      message = format('PGDAS-D bloqueado: Fator R possui apenas %s de 12 competências preenchidas.', _months_complete),
      detail = 'PGDAS_FACTOR_R_DATA_INCOMPLETE';
  end if;

  _factor_r := case
    when _payroll_fs12 = 0 then 0.01
    when _revenue_rbt12 = 0 then 0.28
    else round(_payroll_fs12 / _revenue_rbt12, 6)
  end;

  if _factor_r < 0.28 then
    raise exception using
      errcode = 'P0001',
      message = format('PGDAS-D bloqueado: Fator R de %s%% está abaixo do mínimo de 28%%.', to_char(_factor_r * 100, 'FM990D00')),
      detail = 'PGDAS_FACTOR_R_BELOW_THRESHOLD';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_pgdas_factor_r_gate() from public, anon, authenticated;

drop trigger if exists enforce_pgdas_factor_r_gate on public.obligation_instances;
create trigger enforce_pgdas_factor_r_gate
before insert or update of status on public.obligation_instances
for each row execute function private.enforce_pgdas_factor_r_gate();

comment on function private.enforce_pgdas_factor_r_gate() is
  'Bloqueia prontidão, envio e conclusão do PGDAS-D de clientes Fator R quando FS12/RBT12 está incompleto ou abaixo de 28%.';
