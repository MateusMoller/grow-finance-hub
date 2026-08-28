-- Consolidate aliases created by the Simples automation rollout.
-- Related records are repointed transactionally; source template metadata is archived in the audit trail.
select pg_advisory_xact_lock(hashtextextended('grow-obligations:deduplicate-templates',0));

create temporary table _template_merge_map(source_id uuid primary key,target_id uuid not null) on commit drop;

insert into _template_merge_map(source_id,target_id)
select duplicate.id,canonical.id
from public.obligation_templates duplicate
join public.obligation_templates canonical on canonical.organization_id=duplicate.organization_id
where (duplicate.code in ('PGDASD','pgdasd','pgdas-d','pgdasd-mensal') and canonical.code='pgdas_d')
   or (duplicate.code in ('DEFIS','defis-anual','defis_anual') and canonical.code='defis');

do $$
begin
  if exists(
    select 1 from public.client_obligation_profiles source
    join _template_merge_map map on map.source_id=source.template_id
    join public.client_obligation_profiles target on target.client_id=source.client_id and target.template_id=map.target_id
  ) then raise exception 'duplicate_profile_merge_requires_manual_resolution'; end if;
  if exists(
    select 1 from public.obligation_instances source
    join _template_merge_map map on map.source_id=source.template_id
    join public.obligation_instances target on target.client_id=source.client_id and target.template_id=map.target_id and target.competence_key=source.competence_key
  ) then raise exception 'duplicate_instance_merge_requires_manual_resolution'; end if;
end $$;

insert into public.obligation_audit_events(organization_id,template_id,entity_type,entity_id,action,metadata)
select source.organization_id,map.target_id,'obligation_template',map.target_id,'duplicate_template_merged',
  jsonb_build_object('source_template',to_jsonb(source),'target_template_id',map.target_id,'preservation','all foreign keys repointed transactionally')
from _template_merge_map map join public.obligation_templates source on source.id=map.source_id;

update public.client_obligation_profiles row set template_id=map.target_id,updated_at=now()
from _template_merge_map map where row.template_id=map.source_id;
update public.obligation_instances row set template_id=map.target_id
from _template_merge_map map where row.template_id=map.source_id;
update public.expected_document_reference_files row set template_id=map.target_id
from _template_merge_map map where row.template_id=map.source_id;
update public.document_inbox_items row set suggested_template_id=map.target_id
from _template_merge_map map where row.suggested_template_id=map.source_id;
update public.document_ingestion_jobs row set template_id=map.target_id
from _template_merge_map map where row.template_id=map.source_id;
update public.document_model_validation_samples row set expected_template_id=map.target_id
from _template_merge_map map where row.expected_template_id=map.source_id;
update public.document_model_validation_samples row set actual_template_id=map.target_id
from _template_merge_map map where row.actual_template_id=map.source_id;
update public.obligation_load_application_reviews row set template_id=map.target_id
from _template_merge_map map where row.template_id=map.source_id;
update public.obligation_regime_load_items row set template_id=map.target_id
from _template_merge_map map where row.template_id=map.source_id;
update public.simple_national_dossiers row set template_id=map.target_id
from _template_merge_map map where row.template_id=map.source_id;
update public.obligation_audit_events row
set template_id=map.target_id,
    metadata=coalesce(row.metadata,'{}'::jsonb)||jsonb_build_object('original_template_id',map.source_id,'merged_into_template_id',map.target_id)
from _template_merge_map map where row.template_id=map.source_id;

delete from public.obligation_templates source using _template_merge_map map where source.id=map.source_id;

-- DAS is the payment document/control and is not the PGDAS-D declaration.
update public.obligation_templates set normalized_name='das',duplicate_group_key='das',updated_at=now()
where code='das';
update public.obligation_templates set normalized_name='pgdas d',duplicate_group_key='pgdas_d',updated_at=now()
where code='pgdas_d';
update public.obligation_templates set normalized_name='defis',duplicate_group_key='defis',updated_at=now()
where code='defis';

create or replace function public.assign_canonical_obligation_duplicate_group()
returns trigger language plpgsql set search_path='' as $$
declare _identity text:=lower(regexp_replace(coalesce(new.code,'')||' '||coalesce(new.name,''),'[^a-zA-Z0-9]+','','g'));
begin
  if _identity in ('pgdasdpgdasd','pgdasdpgdasdmensal','pgdasd','pgdasdmensal') then
    new.duplicate_group_key:='pgdas_d';
  elsif _identity in ('defisdefis','defisdefisanual','defis','defisanual') then
    new.duplicate_group_key:='defis';
  elsif lower(coalesce(new.code,''))='das' then
    new.duplicate_group_key:='das';
  end if;
  return new;
end $$;

revoke all on function public.assign_canonical_obligation_duplicate_group() from public,anon,authenticated;
drop trigger if exists assign_canonical_obligation_duplicate_group on public.obligation_templates;
create trigger assign_canonical_obligation_duplicate_group
before insert or update of code,name,duplicate_group_key on public.obligation_templates
for each row execute function public.assign_canonical_obligation_duplicate_group();

create unique index if not exists obligation_templates_active_semantic_identity
on public.obligation_templates(organization_id,duplicate_group_key)
where is_active and duplicate_group_key is not null;
