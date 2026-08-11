-- Read paths used by the obligations workspace and client history.
create index if not exists idx_obligation_instances_org_status_due
  on public.obligation_instances (organization_id, status, technical_due_date, id);

create index if not exists idx_obligation_instances_org_client_competence
  on public.obligation_instances (organization_id, client_id, competence_key desc, id);

create index if not exists idx_client_obligation_profiles_org_client_active_start
  on public.client_obligation_profiles (organization_id, client_id, is_active desc, start_date desc, id);

create index if not exists idx_kanban_tasks_obligation_integration_lookup
  on public.kanban_tasks (organization_id, integration_task_id)
  where integration_source = 'grow_obligation_task';

create index if not exists idx_obligation_instances_org_competence_due
  on public.obligation_instances (organization_id, competence_date, technical_due_date, id);

create index if not exists idx_obligation_instances_org_template_due
  on public.obligation_instances (organization_id, template_id, technical_due_date, id);
