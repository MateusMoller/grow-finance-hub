alter table public.simple_national_dossiers
  add column if not exists template_id uuid references public.obligation_templates(id) on delete restrict;

create index if not exists simple_national_dossiers_template_idx
  on public.simple_national_dossiers (organization_id, template_id, competence_key);

create or replace function public.ensure_simple_national_system_templates(_organization_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.obligation_templates(
    organization_id,code,name,sector,periodicity,competence_reference,technical_due_month_reference,
    competence_granularity,competence_year_offset,due_day,yearly_due_month,due_fixed_month,priority,
    expected_documents,is_active,generates_calendar,generates_kanban,requires_document,operational_notes,
    baseline_source,catalog_review_status,normalized_name
  ) values
  (_organization_id,'pgdas_d','PGDAS-D','Fiscal','monthly','anterior','vigente','month',0,20,null,null,'alta',
   '[{"document_type_key":"pgdasd_recibo","label":"Recibo PGDAS-D","required":true,"active":true,"aliases":[]},{"document_type_key":"das","label":"DAS","required":true,"active":true,"aliases":[]}]'::jsonb,
   true,true,true,true,'Obrigação padrão vinculada à automação assistida do Integra Contador.','integra_contador_system','approved','pgdas d'),
  (_organization_id,'defis','DEFIS','Fiscal','yearly','vigente','vigente','year',0,31,3,3,'alta',
   '[{"document_type_key":"defis_recibo","label":"Recibo DEFIS","required":true,"active":true,"aliases":[]}]'::jsonb,
   true,true,true,true,'Obrigação padrão vinculada à automação assistida do Integra Contador.','integra_contador_system','approved','defis')
  on conflict (organization_id,code) do update set
    name=excluded.name,sector=excluded.sector,periodicity=excluded.periodicity,
    competence_reference=excluded.competence_reference,technical_due_month_reference=excluded.technical_due_month_reference,
    competence_granularity=excluded.competence_granularity,competence_year_offset=excluded.competence_year_offset,
    due_day=excluded.due_day,yearly_due_month=excluded.yearly_due_month,due_fixed_month=excluded.due_fixed_month,
    priority=excluded.priority,expected_documents=excluded.expected_documents,is_active=true,
    generates_calendar=true,generates_kanban=true,requires_document=true,
    operational_notes=excluded.operational_notes,baseline_source='integra_contador_system',
    catalog_review_status='approved',normalized_name=excluded.normalized_name,updated_at=now();

  update public.obligation_templates
  set is_active=false, baseline_source='superseded_integra_contador_seed', updated_at=now()
  where organization_id=_organization_id
    and code in ('PGDASD','DEFIS')
    and code not in ('pgdas_d','defis');
end $$;

revoke all on function public.ensure_simple_national_system_templates(uuid) from public,anon,authenticated;
grant execute on function public.ensure_simple_national_system_templates(uuid) to service_role;

create or replace function public.link_simple_national_dossier_to_obligation()
returns trigger
language plpgsql security definer set search_path = public as $$
declare _template_id uuid; _profile_id uuid; _instance_id uuid;
begin
  perform public.ensure_simple_national_system_templates(new.organization_id);
  select id into _template_id from public.obligation_templates
  where organization_id=new.organization_id
    and code=case new.obligation_kind when 'pgdasd' then 'pgdas_d' when 'defis' then 'defis' end
    and is_active limit 1;
  if _template_id is null then raise exception 'system_obligation_template_not_available'; end if;

  insert into public.client_obligation_profiles(
    organization_id,client_id,template_id,start_date,is_active,source_kind,applied_regime,created_by
  ) values(new.organization_id,new.client_id,_template_id,current_date,true,'automation','simples_nacional',coalesce(new.created_by,auth.uid()))
  on conflict(client_id,template_id) do update set
    is_active=true,end_date=null,source_kind='automation',applied_regime='simples_nacional',updated_at=now()
  returning id into _profile_id;

  select i.id into _instance_id
  from public.obligation_instances i
  where i.organization_id=new.organization_id and i.client_id=new.client_id and i.template_id=_template_id
    and regexp_replace(i.competence_key,'\D','','g')=new.competence_key
    and i.superseded_by_instance_id is null
  order by i.created_at desc limit 1;

  if new.obligation_instance_id is not null and not exists (
    select 1 from public.obligation_instances i
    where i.id=new.obligation_instance_id and i.organization_id=new.organization_id
      and i.client_id=new.client_id and i.template_id=_template_id
  ) then
    raise exception 'obligation_instance_template_mismatch';
  end if;

  new.template_id := _template_id;
  new.obligation_instance_id := coalesce(new.obligation_instance_id,_instance_id);
  return new;
end $$;

revoke all on function public.link_simple_national_dossier_to_obligation() from public,anon,authenticated;
drop trigger if exists link_simple_national_dossier_to_obligation on public.simple_national_dossiers;
create trigger link_simple_national_dossier_to_obligation
before insert or update of client_id,obligation_kind,competence_key on public.simple_national_dossiers
for each row execute function public.link_simple_national_dossier_to_obligation();

create or replace function public.protect_simple_national_system_template()
returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='DELETE' then raise exception 'system_obligation_cannot_be_deleted' using errcode='42501'; end if;
  new.code:=old.code; new.organization_id:=old.organization_id; new.baseline_source:=old.baseline_source; new.is_active:=true;
  return new;
end $$;

revoke all on function public.protect_simple_national_system_template() from public,anon,authenticated;
drop trigger if exists protect_simple_national_system_template on public.obligation_templates;
create trigger protect_simple_national_system_template
before update or delete on public.obligation_templates
for each row when (old.baseline_source='integra_contador_system')
execute function public.protect_simple_national_system_template();

do $$ declare _org uuid; begin
  for _org in select id from public.organizations loop perform public.ensure_simple_national_system_templates(_org); end loop;
end $$;

update public.simple_national_dossiers set competence_key=competence_key;

alter table public.simple_national_dossiers alter column template_id set not null;
