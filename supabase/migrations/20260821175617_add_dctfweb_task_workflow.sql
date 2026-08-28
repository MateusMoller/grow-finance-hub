create table if not exists public.dctfweb_dossiers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  obligation_instance_id uuid not null references public.obligation_instances(id) on delete cascade,
  competence_key text not null check (competence_key ~ '^\d{6}$'),
  category text not null default 'GERAL_MENSAL',
  status text not null default 'collecting' check (status in ('collecting','ready_for_review','approved','consulted','documents_issued','transmitting','transmitted','completed','requires_action','transmission_unknown')),
  data_version integer not null default 1 check (data_version > 0),
  approved_data_version integer,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  receipt_number text,
  provider_state jsonb not null default '{}'::jsonb,
  xml_storage_path text,
  receipt_storage_path text,
  report_storage_path text,
  darf_storage_path text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, client_id, competence_key, category),
  unique (obligation_instance_id, category)
);

create table if not exists public.dctfweb_operations (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  dossier_id uuid not null references public.dctfweb_dossiers(id) on delete cascade, task_id uuid references public.kanban_tasks(id) on delete set null,
  service_key text not null, idempotency_key text not null, status text not null,
  request_tag text, provider_code text, error_code text, metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), finished_at timestamptz,
  unique (organization_id, idempotency_key)
);

create table if not exists public.dctfweb_artifacts (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  dossier_id uuid not null references public.dctfweb_dossiers(id) on delete cascade,
  obligation_instance_id uuid not null references public.obligation_instances(id) on delete cascade,
  artifact_type text not null check (artifact_type in ('xml','receipt','complete_report','darf')),
  storage_path text not null, content_sha256 text not null, mime_type text not null, byte_size bigint not null check (byte_size >= 0),
  provider_reference text, created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(),
  unique (dossier_id, artifact_type, content_sha256)
);

create index if not exists idx_dctfweb_dossiers_org_client on public.dctfweb_dossiers(organization_id,client_id,competence_key desc);
create index if not exists idx_dctfweb_operations_dossier on public.dctfweb_operations(organization_id,dossier_id,created_at desc);
alter table public.dctfweb_dossiers enable row level security;
alter table public.dctfweb_operations enable row level security;
alter table public.dctfweb_artifacts enable row level security;

create policy "Tenant internal DCTFWeb dossiers" on public.dctfweb_dossiers for all to authenticated
using (public.is_internal_user((select auth.uid()),organization_id)) with check (public.is_internal_user((select auth.uid()),organization_id));
create policy "Tenant internal DCTFWeb operations" on public.dctfweb_operations for all to authenticated
using (public.is_internal_user((select auth.uid()),organization_id)) with check (public.is_internal_user((select auth.uid()),organization_id));
create policy "Tenant internal DCTFWeb artifacts" on public.dctfweb_artifacts for all to authenticated
using (public.is_internal_user((select auth.uid()),organization_id)) with check (public.is_internal_user((select auth.uid()),organization_id));
grant select,insert,update on public.dctfweb_dossiers,public.dctfweb_operations,public.dctfweb_artifacts to authenticated;

create or replace function public.prepare_dctfweb_dossier(_organization_id uuid,_client_id uuid,_instance_id uuid,_competence_key text,_category text default 'GERAL_MENSAL') returns uuid
language plpgsql security definer set search_path=public as $$
declare _id uuid;
begin
  if auth.uid() is null or not public.is_internal_user(auth.uid(),_organization_id) then raise exception 'forbidden' using errcode='42501'; end if;
  if _competence_key !~ '^\d{6}$' or _category not in ('GERAL_MENSAL','PF_MENSAL','GERAL_ANUAL','ESPETACULO_DESPORTIVO') then raise exception 'invalid_dctfweb_context'; end if;
  if not exists(select 1 from public.obligation_instances i where i.id=_instance_id and i.organization_id=_organization_id and i.client_id=_client_id and i.superseded_by_instance_id is null) then raise exception 'obligation_not_available'; end if;
  insert into public.dctfweb_dossiers(organization_id,client_id,obligation_instance_id,competence_key,category,created_by,updated_by)
  values(_organization_id,_client_id,_instance_id,_competence_key,_category,auth.uid(),auth.uid())
  on conflict(organization_id,client_id,competence_key,category) do update set obligation_instance_id=excluded.obligation_instance_id,updated_by=auth.uid(),updated_at=now()
  returning id into _id;
  perform public.record_operational_audit_log(_organization_id,'dctfweb.dossier_prepared','dctfweb_dossier',_id,_client_id,'success',jsonb_build_object('competence',_competence_key,'category',_category),null);
  return _id;
end $$;
revoke all on function public.prepare_dctfweb_dossier(uuid,uuid,uuid,text,text) from public,anon;
grant execute on function public.prepare_dctfweb_dossier(uuid,uuid,uuid,text,text) to authenticated;
