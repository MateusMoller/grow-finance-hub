-- Safe, tenant-scoped workflow for Simples Nacional obligations.
-- External transmission remains blocked until the contracted SERPRO provider is enabled.

create table public.simple_national_dossiers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  obligation_instance_id uuid references public.obligation_instances(id) on delete set null,
  obligation_kind text not null check (obligation_kind in ('pgdasd','defis','regime_apuracao')),
  competence_key text not null check (competence_key ~ '^\d{4}(\d{2})?$'),
  status text not null default 'collecting' check (status in (
    'collecting','validation_failed','ready_for_review','approved','transmission_blocked',
    'queued','transmitting','transmitted','documents_issued','published','completed','requires_action'
  )),
  calculation_mode text not null default 'preview_only' check (calculation_mode in ('preview_only','official')),
  input_data jsonb not null default '{}'::jsonb,
  source_manifest jsonb not null default '[]'::jsonb check (jsonb_typeof(source_manifest) = 'array'),
  validation_summary jsonb not null default jsonb_build_object('blocking', jsonb_build_array(), 'warnings', jsonb_build_array()),
  preview_result jsonb,
  data_version integer not null default 1 check (data_version > 0),
  approved_data_version integer,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  external_operation_id uuid references public.fiscal_operations(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, client_id, obligation_kind, competence_key)
);

create table public.simple_national_dossier_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  dossier_id uuid not null references public.simple_national_dossiers(id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status text,
  data_version integer not null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index simple_national_dossiers_queue_idx
  on public.simple_national_dossiers (organization_id, status, competence_key desc);
create index simple_national_dossiers_client_idx
  on public.simple_national_dossiers (organization_id, client_id, obligation_kind, competence_key desc);
create index simple_national_dossier_events_idx
  on public.simple_national_dossier_events (organization_id, dossier_id, created_at desc);

alter table public.simple_national_dossiers enable row level security;
alter table public.simple_national_dossier_events enable row level security;
revoke all on public.simple_national_dossiers, public.simple_national_dossier_events from anon, authenticated;

create policy simple_national_dossiers_tenant_read on public.simple_national_dossiers
  for select to authenticated
  using (public.is_internal_user((select auth.uid()), organization_id));
create policy simple_national_dossier_events_tenant_read on public.simple_national_dossier_events
  for select to authenticated
  using (public.is_internal_user((select auth.uid()), organization_id));
grant select on public.simple_national_dossiers, public.simple_national_dossier_events to authenticated;

create or replace function public.validate_simple_national_payload(
  _kind text,
  _competence_key text,
  _input jsonb,
  _sources jsonb
) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  _blocking jsonb := '[]'::jsonb;
  _warnings jsonb := '[]'::jsonb;
  _revenue numeric;
begin
  if _kind not in ('pgdasd','defis','regime_apuracao') then
    _blocking := _blocking || jsonb_build_array(jsonb_build_object('code','unsupported_obligation','message','Obrigação não suportada.'));
  end if;
  if _competence_key !~ '^\d{4}(\d{2})?$' then
    _blocking := _blocking || jsonb_build_array(jsonb_build_object('code','invalid_competence','message','Competência inválida.'));
  end if;
  if jsonb_typeof(coalesce(_sources, 'null'::jsonb)) <> 'array' or jsonb_array_length(_sources) = 0 then
    _blocking := _blocking || jsonb_build_array(jsonb_build_object('code','missing_sources','message','Informe ao menos uma fonte dos dados.'));
  end if;

  if _kind = 'pgdasd' then
    if length(regexp_replace(coalesce(_input->>'cnpj',''), '\D', '', 'g')) <> 14 then
      _blocking := _blocking || jsonb_build_array(jsonb_build_object('code','invalid_cnpj','message','CNPJ do contribuinte é obrigatório.'));
    end if;
    if coalesce(_input->>'revenue_regime','') not in ('caixa','competencia') then
      _blocking := _blocking || jsonb_build_array(jsonb_build_object('code','missing_revenue_regime','message','Defina o regime de caixa ou competência.'));
    end if;
    begin _revenue := (_input->>'revenue_total')::numeric; exception when others then _revenue := null; end;
    if _revenue is null or _revenue < 0 then
      _blocking := _blocking || jsonb_build_array(jsonb_build_object('code','invalid_revenue','message','Informe a receita total da competência.'));
    end if;
    if jsonb_typeof(coalesce(_input->'revenue_by_activity','null'::jsonb)) <> 'array'
       or jsonb_array_length(_input->'revenue_by_activity') = 0 then
      _blocking := _blocking || jsonb_build_array(jsonb_build_object('code','missing_activity_breakdown','message','Classifique a receita por atividade.'));
    end if;
    if not (_input ? 'payroll_r12') then
      _warnings := _warnings || jsonb_build_array(jsonb_build_object('code','payroll_not_informed','message','Folha R12 não informada; confirme se o Fator R não se aplica.'));
    end if;
  elsif _kind = 'defis' then
    if length(_competence_key) <> 4 then
      _blocking := _blocking || jsonb_build_array(jsonb_build_object('code','defis_requires_year','message','A DEFIS exige ano-calendário.'));
    end if;
    if not (_input ? 'annual_revenue') or not (_input ? 'partners_reviewed') then
      _blocking := _blocking || jsonb_build_array(jsonb_build_object('code','defis_incomplete','message','Receita anual e revisão de sócios são obrigatórias.'));
    end if;
  elsif _kind = 'regime_apuracao' then
    if length(_competence_key) <> 4 or coalesce(_input->>'revenue_regime','') not in ('caixa','competencia') then
      _blocking := _blocking || jsonb_build_array(jsonb_build_object('code','regime_incomplete','message','Informe ano e regime de apuração.'));
    end if;
  end if;
  return jsonb_build_object('blocking', _blocking, 'warnings', _warnings, 'valid', jsonb_array_length(_blocking) = 0);
end $$;

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
  select * into _client from public.clients where id = _client_id and organization_id = _organization_id and status = 'Ativo';
  if not found then raise exception 'client_not_available'; end if;
  if lower(coalesce(_client.regime,'')) not like '%simples%' then raise exception 'client_not_simples_nacional'; end if;
  if _obligation_instance_id is not null and not exists (
    select 1 from public.obligation_instances i where i.id = _obligation_instance_id and i.client_id = _client_id
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
  do update set obligation_instance_id = coalesce(excluded.obligation_instance_id, simple_national_dossiers.obligation_instance_id), updated_at = now(), updated_by = auth.uid()
  returning id into _id;
  insert into public.simple_national_dossier_events(organization_id,dossier_id,event_type,to_status,data_version,created_by)
  select organization_id,id,'dossier_created',status,data_version,auth.uid() from public.simple_national_dossiers where id=_id;
  perform public.record_operational_audit_log(_organization_id,'simples_nacional.dossier_created','simple_national_dossier',_id,_client_id,'success',jsonb_build_object('kind',_kind,'competence',_competence_key),null);
  return _id;
end $$;

create or replace function public.save_simple_national_dossier(
  _organization_id uuid,
  _dossier_id uuid,
  _input_data jsonb,
  _source_manifest jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare _old public.simple_national_dossiers%rowtype; _validation jsonb; _new_status text;
begin
  if auth.uid() is null or not public.is_internal_user(auth.uid(), _organization_id) then raise exception 'forbidden' using errcode='42501'; end if;
  select * into _old from public.simple_national_dossiers where id=_dossier_id and organization_id=_organization_id for update;
  if not found then raise exception 'dossier_not_available'; end if;
  if _old.status in ('transmitting','transmitted','documents_issued','published','completed') then raise exception 'dossier_locked'; end if;
  _validation := public.validate_simple_national_payload(_old.obligation_kind,_old.competence_key,coalesce(_input_data,'{}'),coalesce(_source_manifest,'[]'));
  _new_status := case when (_validation->>'valid')::boolean then 'ready_for_review' else 'validation_failed' end;
  update public.simple_national_dossiers set input_data=coalesce(_input_data,'{}'),source_manifest=coalesce(_source_manifest,'[]'),validation_summary=_validation,
    status=_new_status,data_version=data_version+1,approved_by=null,approved_at=null,approved_data_version=null,preview_result=null,updated_by=auth.uid(),updated_at=now()
  where id=_dossier_id;
  insert into public.simple_national_dossier_events(organization_id,dossier_id,event_type,from_status,to_status,data_version,metadata,created_by)
  values(_organization_id,_dossier_id,'data_validated',_old.status,_new_status,_old.data_version+1,_validation,auth.uid());
  perform public.record_operational_audit_log(_organization_id,'simples_nacional.dossier_validated','simple_national_dossier',_dossier_id,_old.client_id,
    case when (_validation->>'valid')::boolean then 'success' else 'requires_action' end,jsonb_build_object('dataVersion',_old.data_version+1),null);
  return jsonb_build_object('id',_dossier_id,'status',_new_status,'dataVersion',_old.data_version+1,'validation',_validation);
end $$;

create or replace function public.approve_simple_national_dossier(_organization_id uuid,_dossier_id uuid,_expected_version integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare _d public.simple_national_dossiers%rowtype;
begin
  if auth.uid() is null or not public.is_internal_user(auth.uid(),_organization_id) then raise exception 'forbidden' using errcode='42501';end if;
  select * into _d from public.simple_national_dossiers where id=_dossier_id and organization_id=_organization_id for update;
  if not found then raise exception 'dossier_not_available';end if;
  if _d.status <> 'ready_for_review' or _d.data_version <> _expected_version then raise exception 'dossier_changed_or_not_ready';end if;
  update public.simple_national_dossiers set status='approved',approved_by=auth.uid(),approved_at=now(),approved_data_version=data_version,updated_by=auth.uid(),updated_at=now() where id=_dossier_id;
  insert into public.simple_national_dossier_events(organization_id,dossier_id,event_type,from_status,to_status,data_version,created_by)
  values(_organization_id,_dossier_id,'approved',_d.status,'approved',_d.data_version,auth.uid());
  perform public.record_operational_audit_log(_organization_id,'simples_nacional.dossier_approved','simple_national_dossier',_dossier_id,_d.client_id,'success',jsonb_build_object('dataVersion',_d.data_version),null);
  return jsonb_build_object('id',_dossier_id,'status','approved','dataVersion',_d.data_version);
end $$;

create or replace function public.request_simple_national_transmission(_organization_id uuid,_dossier_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare _d public.simple_national_dossiers%rowtype; _provider text := current_setting('app.settings.integra_contador_provider',true);
begin
  if auth.uid() is null or not public.is_internal_user(auth.uid(),_organization_id) then raise exception 'forbidden' using errcode='42501';end if;
  select * into _d from public.simple_national_dossiers where id=_dossier_id and organization_id=_organization_id for update;
  if not found or _d.status <> 'approved' or _d.approved_data_version <> _d.data_version then raise exception 'dossier_not_approved';end if;
  -- Database-side hard stop. The Edge Function performs the provider check again.
  update public.simple_national_dossiers set status='transmission_blocked',updated_by=auth.uid(),updated_at=now() where id=_dossier_id;
  insert into public.simple_national_dossier_events(organization_id,dossier_id,event_type,from_status,to_status,data_version,metadata,created_by)
  values(_organization_id,_dossier_id,'transmission_blocked',_d.status,'transmission_blocked',_d.data_version,jsonb_build_object('reason','production_provider_not_enabled'),auth.uid());
  perform public.record_operational_audit_log(_organization_id,'simples_nacional.transmission_blocked','simple_national_dossier',_dossier_id,_d.client_id,'requires_action',jsonb_build_object('reason','production_provider_not_enabled'),null);
  return jsonb_build_object('id',_dossier_id,'status','transmission_blocked','reason','production_provider_not_enabled');
end $$;

create or replace function public.list_simple_national_dossiers(_organization_id uuid,_limit integer default 50)
returns table(id uuid,client_id uuid,client_name text,obligation_instance_id uuid,obligation_kind text,competence_key text,status text,input_data jsonb,source_manifest jsonb,validation_summary jsonb,preview_result jsonb,data_version integer,approved_at timestamptz,updated_at timestamptz)
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or not public.is_internal_user(auth.uid(),_organization_id) then raise exception 'forbidden' using errcode='42501';end if;
  return query select d.id,d.client_id,c.name,d.obligation_instance_id,d.obligation_kind,d.competence_key,d.status,d.input_data,d.source_manifest,d.validation_summary,d.preview_result,d.data_version,d.approved_at,d.updated_at
  from public.simple_national_dossiers d join public.clients c on c.id=d.client_id
  where d.organization_id=_organization_id order by d.updated_at desc limit least(greatest(coalesce(_limit,50),1),100);
end $$;

create or replace function public.list_simple_national_clients(_organization_id uuid)
returns table(id uuid,name text,cnpj text,regime text)
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or not public.is_internal_user(auth.uid(),_organization_id) then
    raise exception 'forbidden' using errcode='42501';
  end if;
  return query
  select c.id,c.name,c.cnpj,c.regime
  from public.clients c
  where c.organization_id=_organization_id
    and c.status='Ativo'
    and lower(coalesce(c.regime,'')) like '%simples%'
  order by c.name;
end $$;

revoke all on function public.validate_simple_national_payload(text,text,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.create_simple_national_dossier(uuid,uuid,text,text,uuid) from public,anon;
revoke all on function public.save_simple_national_dossier(uuid,uuid,jsonb,jsonb) from public,anon;
revoke all on function public.approve_simple_national_dossier(uuid,uuid,integer) from public,anon;
revoke all on function public.request_simple_national_transmission(uuid,uuid) from public,anon;
revoke all on function public.list_simple_national_dossiers(uuid,integer) from public,anon;
revoke all on function public.list_simple_national_clients(uuid) from public,anon;
grant execute on function public.create_simple_national_dossier(uuid,uuid,text,text,uuid),public.save_simple_national_dossier(uuid,uuid,jsonb,jsonb),public.approve_simple_national_dossier(uuid,uuid,integer),public.request_simple_national_transmission(uuid,uuid),public.list_simple_national_dossiers(uuid,integer),public.list_simple_national_clients(uuid) to authenticated;

alter table public.obligation_templates add column if not exists requires_protocol boolean not null default false;

insert into public.obligation_templates(code,name,sector,periodicity,due_day,priority,expected_documents,is_active,generates_calendar,generates_kanban,requires_protocol,requires_document,operational_notes)
values
 ('PGDASD','PGDAS-D Mensal','Fiscal','monthly',20,'alta','[{"key":"pgdasd_recibo","label":"Recibo PGDAS-D","required":true},{"key":"das","label":"DAS","required":true}]'::jsonb,true,true,false,true,true,'Automação assistida: validar, revisar, transmitir e emitir DAS.'),
 ('DEFIS','DEFIS Anual','Fiscal','yearly',31,'alta','[{"key":"defis_recibo","label":"Recibo DEFIS","required":true}]'::jsonb,true,true,false,true,true,'Automação assistida com revisão humana obrigatória.')
on conflict do nothing;
