alter table public.simple_national_dossiers
  add column if not exists external_declaration_id text,
  add column if not exists external_transmitted_at timestamptz,
  add column if not exists declaration_storage_path text,
  add column if not exists receipt_storage_path text,
  add column if not exists das_storage_path text,
  add column if not exists das_number text,
  add column if not exists das_due_date date,
  add column if not exists das_total numeric(15,2),
  add column if not exists provider_environment text not null default 'trial'
    check (provider_environment in ('trial','production'));

create or replace function public.record_pgdasd_preview(
  _organization_id uuid,
  _dossier_id uuid,
  _expected_version integer,
  _preview jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare _d public.simple_national_dossiers%rowtype;
begin
  if auth.uid() is null or not public.is_internal_user(auth.uid(), _organization_id) then raise exception 'forbidden' using errcode='42501'; end if;
  select * into _d from public.simple_national_dossiers where id=_dossier_id and organization_id=_organization_id for update;
  if not found or _d.obligation_kind <> 'pgdasd' then raise exception 'dossier_not_available'; end if;
  if _d.data_version <> _expected_version or _d.status not in ('ready_for_review','approved','transmission_blocked') then raise exception 'dossier_changed_or_not_ready'; end if;
  update public.simple_national_dossiers set
    preview_result=coalesce(_preview,'{}'::jsonb), calculation_mode='official',
    status='ready_for_review', approved_by=null, approved_at=null, approved_data_version=null,
    updated_by=auth.uid(), updated_at=now()
  where id=_dossier_id;
  insert into public.simple_national_dossier_events(organization_id,dossier_id,event_type,from_status,to_status,data_version,metadata,created_by)
  values(_organization_id,_dossier_id,'official_calculation_previewed',_d.status,'ready_for_review',_d.data_version,jsonb_build_object('provider','trial'),auth.uid());
  perform public.record_operational_audit_log(_organization_id,'simples_nacional.pgdasd_previewed','simple_national_dossier',_dossier_id,_d.client_id,'success',jsonb_build_object('dataVersion',_d.data_version,'provider','trial'),null);
  return jsonb_build_object('id',_dossier_id,'status','ready_for_review','preview',_preview);
end $$;

create or replace function public.record_pgdasd_transmission(
  _organization_id uuid,
  _dossier_id uuid,
  _expected_version integer,
  _external_declaration_id text,
  _external_transmitted_at timestamptz,
  _declaration_storage_path text,
  _receipt_storage_path text,
  _tax_values jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare _d public.simple_national_dossiers%rowtype;
begin
  if auth.uid() is null or not public.is_internal_user(auth.uid(), _organization_id) then raise exception 'forbidden' using errcode='42501'; end if;
  select * into _d from public.simple_national_dossiers where id=_dossier_id and organization_id=_organization_id for update;
  if not found or _d.obligation_kind <> 'pgdasd' then raise exception 'dossier_not_available'; end if;
  if _d.status <> 'approved' or _d.data_version <> _expected_version or _d.approved_data_version <> _expected_version then raise exception 'dossier_not_approved'; end if;
  update public.simple_national_dossiers set
    status='transmitted', external_declaration_id=nullif(_external_declaration_id,''), external_transmitted_at=_external_transmitted_at,
    declaration_storage_path=_declaration_storage_path, receipt_storage_path=_receipt_storage_path,
    preview_result=jsonb_set(coalesce(preview_result,'{}'::jsonb),'{taxValues}',coalesce(_tax_values,'[]'::jsonb),true),
    provider_environment='trial', updated_by=auth.uid(), updated_at=now()
  where id=_dossier_id;
  insert into public.simple_national_dossier_events(organization_id,dossier_id,event_type,from_status,to_status,data_version,metadata,created_by)
  values(_organization_id,_dossier_id,'declaration_transmitted',_d.status,'transmitted',_d.data_version,jsonb_build_object('provider','trial','externalDeclarationId',_external_declaration_id),auth.uid());
  perform public.record_operational_audit_log(_organization_id,'simples_nacional.pgdasd_transmitted','simple_national_dossier',_dossier_id,_d.client_id,'success',jsonb_build_object('provider','trial','externalDeclarationId',_external_declaration_id),null);
  return jsonb_build_object('id',_dossier_id,'status','transmitted');
end $$;

create or replace function public.record_pgdasd_das(
  _organization_id uuid,
  _dossier_id uuid,
  _das_storage_path text,
  _das_number text,
  _das_due_date date,
  _das_total numeric
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare _d public.simple_national_dossiers%rowtype;
begin
  if auth.uid() is null or not public.is_internal_user(auth.uid(), _organization_id) then raise exception 'forbidden' using errcode='42501'; end if;
  select * into _d from public.simple_national_dossiers where id=_dossier_id and organization_id=_organization_id for update;
  if not found or _d.obligation_kind <> 'pgdasd' or _d.status <> 'transmitted' then raise exception 'declaration_not_transmitted'; end if;
  update public.simple_national_dossiers set status='documents_issued',das_storage_path=_das_storage_path,das_number=nullif(_das_number,''),das_due_date=_das_due_date,das_total=_das_total,updated_by=auth.uid(),updated_at=now() where id=_dossier_id;
  insert into public.simple_national_dossier_events(organization_id,dossier_id,event_type,from_status,to_status,data_version,metadata,created_by)
  values(_organization_id,_dossier_id,'das_issued',_d.status,'documents_issued',_d.data_version,jsonb_build_object('provider','trial','dasNumber',_das_number,'total',_das_total),auth.uid());
  perform public.record_operational_audit_log(_organization_id,'simples_nacional.pgdasd_das_issued','simple_national_dossier',_dossier_id,_d.client_id,'success',jsonb_build_object('provider','trial','dasNumber',_das_number,'total',_das_total),null);
  return jsonb_build_object('id',_dossier_id,'status','documents_issued');
end $$;

drop function if exists public.list_simple_national_dossiers(uuid,integer);
create function public.list_simple_national_dossiers(_organization_id uuid,_limit integer default 50)
returns table(id uuid,client_id uuid,client_name text,obligation_instance_id uuid,obligation_kind text,competence_key text,status text,input_data jsonb,source_manifest jsonb,validation_summary jsonb,preview_result jsonb,data_version integer,approved_at timestamptz,updated_at timestamptz,external_declaration_id text,external_transmitted_at timestamptz,declaration_storage_path text,receipt_storage_path text,das_storage_path text,das_number text,das_due_date date,das_total numeric,provider_environment text)
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or not public.is_internal_user(auth.uid(),_organization_id) then raise exception 'forbidden' using errcode='42501';end if;
  return query select d.id,d.client_id,c.name,d.obligation_instance_id,d.obligation_kind,d.competence_key,d.status,d.input_data,d.source_manifest,d.validation_summary,d.preview_result,d.data_version,d.approved_at,d.updated_at,d.external_declaration_id,d.external_transmitted_at,d.declaration_storage_path,d.receipt_storage_path,d.das_storage_path,d.das_number,d.das_due_date,d.das_total,d.provider_environment
  from public.simple_national_dossiers d join public.clients c on c.id=d.client_id
  where d.organization_id=_organization_id order by d.updated_at desc limit least(greatest(coalesce(_limit,50),1),100);
end $$;

revoke all on function public.record_pgdasd_preview(uuid,uuid,integer,jsonb),public.record_pgdasd_transmission(uuid,uuid,integer,text,timestamptz,text,text,jsonb),public.record_pgdasd_das(uuid,uuid,text,text,date,numeric),public.list_simple_national_dossiers(uuid,integer) from public,anon;
grant execute on function public.record_pgdasd_preview(uuid,uuid,integer,jsonb),public.record_pgdasd_transmission(uuid,uuid,integer,text,timestamptz,text,text,jsonb),public.record_pgdasd_das(uuid,uuid,text,text,date,numeric),public.list_simple_national_dossiers(uuid,integer) to authenticated;
