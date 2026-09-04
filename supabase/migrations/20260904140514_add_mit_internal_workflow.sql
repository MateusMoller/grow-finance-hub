-- MIT is an internal system obligation. It never publishes documents or sends
-- completion messages to the client. Completion is controlled by a verified
-- response from the configured SERPRO contract.

insert into public.obligation_templates (
  organization_id, code, name, sector, periodicity, competence_reference,
  technical_due_month_reference, due_day, priority, expected_documents,
  is_active, generates_calendar, generates_kanban, requires_protocol,
  requires_document, operational_notes, baseline_source, catalog_review_status,
  normalized_name, completion_email_enabled, completion_email_subject,
  completion_email_body, completion_whatsapp_enabled, completion_whatsapp_body
)
select
  organization.id, 'mit', 'MIT - Módulo de Inclusão de Tributos', 'Fiscal',
  'monthly', 'anterior', 'vigente', 31, 'alta', '[]'::jsonb,
  true, true, true, false, false,
  'Obrigação interna do sistema. Preparar, validar, encerrar e confirmar a transmissão pela integração SERPRO. Não enviar documentos ou mensagens ao cliente.',
  'integra_contador_system', 'approved', 'mit modulo de inclusao de tributos',
  false, null, null, false, null
from public.organizations organization
on conflict (organization_id, code) do update set
  name=excluded.name, sector=excluded.sector, periodicity=excluded.periodicity,
  competence_reference=excluded.competence_reference,
  technical_due_month_reference=excluded.technical_due_month_reference,
  due_day=excluded.due_day, priority=excluded.priority,
  expected_documents='[]'::jsonb, is_active=true, generates_calendar=true,
  generates_kanban=true, requires_protocol=false, requires_document=false,
  operational_notes=excluded.operational_notes,
  baseline_source='integra_contador_system', catalog_review_status='approved',
  normalized_name=excluded.normalized_name, completion_email_enabled=false,
  completion_email_subject=null, completion_email_body=null,
  completion_whatsapp_enabled=false, completion_whatsapp_body=null, updated_at=now();

-- Keep DCTFWeb as a separate obligation. Existing profiles are not rewritten,
-- which avoids silently changing clients during deployment.
update public.obligation_templates
set name='DCTFWeb', normalized_name='dctfweb', updated_at=now()
where code='dctfweb_mit' and baseline_source <> 'manual';

create table public.mit_dossiers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  obligation_instance_id uuid not null references public.obligation_instances(id) on delete cascade,
  competence_key text not null check (competence_key ~ '^\d{6}$'),
  status text not null default 'draft' check (status in (
    'draft','ready_for_validation','validated','submitting','processing',
    'transmitted','verified','requires_action','transmission_unknown'
  )),
  data_version integer not null default 1 check (data_version > 0),
  validated_version integer,
  validated_by uuid references auth.users(id) on delete set null,
  validated_at timestamptz,
  protocol_number text,
  receipt_number text,
  provider_state jsonb not null default '{}'::jsonb,
  transmitted_at timestamptz,
  verified_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (obligation_instance_id),
  unique (organization_id, client_id, competence_key)
);

create table public.mit_debts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  dossier_id uuid not null references public.mit_dossiers(id) on delete cascade,
  revenue_code text not null check (revenue_code ~ '^\d{4,6}$'),
  description text not null,
  debit_amount numeric(15,2) not null check (debit_amount >= 0),
  due_date date,
  establishment_cnpj text,
  source text not null default 'manual' check (source in ('manual','accounting_import','serpro')),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.mit_operations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  dossier_id uuid not null references public.mit_dossiers(id) on delete cascade,
  task_id uuid references public.kanban_tasks(id) on delete set null,
  action text not null,
  idempotency_key text not null,
  status text not null check (status in ('processing','completed','failed','transmission_unknown')),
  request_tag text,
  provider_code text,
  error_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (organization_id, idempotency_key)
);

create index mit_dossiers_org_client_idx on public.mit_dossiers (organization_id,client_id,competence_key desc);
create index mit_debts_dossier_idx on public.mit_debts (organization_id,dossier_id);
create index mit_operations_dossier_idx on public.mit_operations (organization_id,dossier_id,created_at desc);

alter table public.mit_dossiers enable row level security;
alter table public.mit_debts enable row level security;
alter table public.mit_operations enable row level security;

create policy "Tenant internal MIT dossiers" on public.mit_dossiers for all to authenticated
using (public.is_internal_user((select auth.uid()),organization_id))
with check (public.is_internal_user((select auth.uid()),organization_id));
create policy "Tenant internal MIT debts" on public.mit_debts for all to authenticated
using (public.is_internal_user((select auth.uid()),organization_id))
with check (public.is_internal_user((select auth.uid()),organization_id));
create policy "Tenant internal MIT operations" on public.mit_operations for all to authenticated
using (public.is_internal_user((select auth.uid()),organization_id))
with check (public.is_internal_user((select auth.uid()),organization_id));

grant select,insert,update,delete on public.mit_dossiers,public.mit_debts to authenticated;
grant select,insert,update on public.mit_operations to authenticated;

create or replace function public.prepare_mit_dossier(
  _organization_id uuid, _client_id uuid, _instance_id uuid, _competence_key text
) returns uuid language plpgsql security definer set search_path=public as $$
declare _id uuid;
begin
  if auth.uid() is null or not public.is_internal_user(auth.uid(),_organization_id) then
    raise exception 'forbidden' using errcode='42501';
  end if;
  if _competence_key !~ '^\d{6}$' then raise exception 'invalid_mit_competence'; end if;
  if not exists (
    select 1 from public.obligation_instances i
    join public.obligation_templates t on t.id=i.template_id
    where i.id=_instance_id and i.organization_id=_organization_id
      and i.client_id=_client_id and i.superseded_by_instance_id is null
      and t.code='mit'
  ) then raise exception 'mit_obligation_not_available'; end if;
  insert into public.mit_dossiers(
    organization_id,client_id,obligation_instance_id,competence_key,created_by,updated_by
  ) values (_organization_id,_client_id,_instance_id,_competence_key,auth.uid(),auth.uid())
  on conflict(obligation_instance_id) do update set updated_by=auth.uid(),updated_at=now()
  returning id into _id;
  return _id;
end $$;

revoke all on function public.prepare_mit_dossier(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.prepare_mit_dossier(uuid,uuid,uuid,text) to authenticated;

create or replace function public.replace_mit_debts(_organization_id uuid,_dossier_id uuid,_debts jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare _debt jsonb;
begin
  if auth.uid() is null or not public.is_internal_user(auth.uid(),_organization_id) then
    raise exception 'forbidden' using errcode='42501';
  end if;
  if jsonb_typeof(_debts)<>'array' or jsonb_array_length(_debts)>200 then raise exception 'invalid_mit_debts'; end if;
  if not exists(select 1 from public.mit_dossiers where id=_dossier_id and organization_id=_organization_id and status in ('draft','ready_for_validation','validated','requires_action')) then
    raise exception 'mit_dossier_not_editable';
  end if;
  delete from public.mit_debts where dossier_id=_dossier_id and organization_id=_organization_id;
  for _debt in select value from jsonb_array_elements(_debts) loop
    if coalesce(_debt->>'revenueCode','') !~ '^\d{4,6}$'
       or length(trim(coalesce(_debt->>'description','')))=0
       or coalesce((_debt->>'debitAmount')::numeric,-1)<0 then
      raise exception 'invalid_mit_debt';
    end if;
    insert into public.mit_debts(
      organization_id,dossier_id,revenue_code,description,debit_amount,due_date,
      establishment_cnpj,source,metadata,created_by
    ) values (
      _organization_id,_dossier_id,_debt->>'revenueCode',trim(_debt->>'description'),
      (_debt->>'debitAmount')::numeric,nullif(_debt->>'dueDate','')::date,
      nullif(regexp_replace(coalesce(_debt->>'establishmentCnpj',''),'\D','','g'),''),
      coalesce(nullif(_debt->>'source',''),'manual'),coalesce(_debt->'metadata','{}'::jsonb),auth.uid()
    );
  end loop;
  update public.mit_dossiers set status='ready_for_validation',data_version=data_version+1,
    validated_version=null,validated_by=null,validated_at=null,updated_by=auth.uid(),updated_at=now()
  where id=_dossier_id and organization_id=_organization_id;
end $$;

revoke all on function public.replace_mit_debts(uuid,uuid,jsonb) from public,anon;
grant execute on function public.replace_mit_debts(uuid,uuid,jsonb) to authenticated;

comment on table public.mit_dossiers is 'Internal-only MIT workflow; never exposed to the client portal.';
