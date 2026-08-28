create or replace function public.ensure_payroll_system_obligations(_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from public.organizations where id = _organization_id) then
    raise exception 'organization_not_found';
  end if;

  insert into public.obligation_templates (
    organization_id,
    code,
    name,
    sector,
    periodicity,
    competence_reference,
    technical_due_month_reference,
    competence_granularity,
    competence_year_offset,
    due_day,
    priority,
    expected_documents,
    is_active,
    generates_calendar,
    generates_kanban,
    requires_document,
    operational_notes,
    baseline_source,
    catalog_review_status,
    normalized_name
  )
  values
    (
      _organization_id,
      'salary_receipt',
      'Recibo de salário',
      'Departamento Pessoal',
      'monthly',
      'anterior',
      'vigente',
      'month',
      0,
      5,
      'alta',
      '[{"document_type_key":"salary_receipt","label":"Recibo de salário","required":true,"active":true,"aliases":["recibo salarial","holerite","contracheque","recibo de pagamento de salário"]}]'::jsonb,
      true,
      true,
      true,
      true,
      'Obrigação mensal padrão usada como evidência da folha de pagamento da competência anterior.',
      'payroll_system',
      'approved',
      'recibo de salario'
    ),
    (
      _organization_id,
      'inss',
      'INSS',
      'Departamento Pessoal',
      'monthly',
      'anterior',
      'vigente',
      'month',
      0,
      20,
      'alta',
      '[{"document_type_key":"inss","label":"Guia de INSS","required":true,"active":true,"aliases":["guia inss","gps","previdência social","darf previdenciário"]}]'::jsonb,
      true,
      true,
      true,
      true,
      'Obrigação mensal padrão para controle da contribuição previdenciária da folha.',
      'payroll_system',
      'approved',
      'inss'
    ),
    (
      _organization_id,
      'fgts',
      'FGTS',
      'Departamento Pessoal',
      'monthly',
      'anterior',
      'vigente',
      'month',
      0,
      20,
      'alta',
      '[{"document_type_key":"fgts","label":"Guia de FGTS","required":true,"active":true,"aliases":["guia fgts","fgts digital","grf","guia de recolhimento do fgts"]}]'::jsonb,
      true,
      true,
      true,
      true,
      'Obrigação mensal padrão para controle do recolhimento do FGTS da folha.',
      'payroll_system',
      'approved',
      'fgts'
    )
  on conflict (organization_id, code) do update set
    name = excluded.name,
    sector = excluded.sector,
    periodicity = excluded.periodicity,
    competence_reference = excluded.competence_reference,
    technical_due_month_reference = excluded.technical_due_month_reference,
    competence_granularity = excluded.competence_granularity,
    competence_year_offset = excluded.competence_year_offset,
    due_day = excluded.due_day,
    priority = excluded.priority,
    expected_documents = excluded.expected_documents,
    is_active = true,
    generates_calendar = true,
    generates_kanban = true,
    requires_document = true,
    operational_notes = excluded.operational_notes,
    baseline_source = 'payroll_system',
    catalog_review_status = 'approved',
    normalized_name = excluded.normalized_name,
    updated_at = now();
end;
$$;

revoke all on function public.ensure_payroll_system_obligations(uuid) from public, anon, authenticated;
grant execute on function public.ensure_payroll_system_obligations(uuid) to service_role;

create or replace function public.ensure_payroll_system_obligations_for_new_organization()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.ensure_payroll_system_obligations(new.id);
  return new;
end;
$$;

revoke all on function public.ensure_payroll_system_obligations_for_new_organization() from public, anon, authenticated;

drop trigger if exists ensure_payroll_system_obligations_after_organization_insert on public.organizations;
create trigger ensure_payroll_system_obligations_after_organization_insert
after insert on public.organizations
for each row execute function public.ensure_payroll_system_obligations_for_new_organization();

create or replace function public.protect_payroll_system_obligation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'system_obligation_cannot_be_deleted' using errcode = '42501';
  end if;

  new.organization_id := old.organization_id;
  new.code := old.code;
  new.baseline_source := old.baseline_source;
  new.is_active := true;
  return new;
end;
$$;

revoke all on function public.protect_payroll_system_obligation() from public, anon, authenticated;

drop trigger if exists protect_payroll_system_obligation on public.obligation_templates;
create trigger protect_payroll_system_obligation
before update or delete on public.obligation_templates
for each row
when (old.baseline_source = 'payroll_system')
execute function public.protect_payroll_system_obligation();

do $$
declare
  _organization_id uuid;
begin
  for _organization_id in select id from public.organizations loop
    perform public.ensure_payroll_system_obligations(_organization_id);
  end loop;
end;
$$;

comment on function public.ensure_payroll_system_obligations(uuid) is
  'Mantém Recibo de salário, INSS e FGTS como obrigações mensais nativas e indeletáveis de cada organização.';
