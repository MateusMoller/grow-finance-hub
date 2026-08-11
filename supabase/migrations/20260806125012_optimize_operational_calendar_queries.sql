-- Read paths used by the operational calendar. These indexes lead with the
-- tenant key and date range because every calendar request is organization-scoped.
create index if not exists idx_calendar_events_org_due_sector
  on public.calendar_events (organization_id, due_at, sector);

create index if not exists idx_kanban_tasks_org_due_sector_status
  on public.kanban_tasks (organization_id, due_date, sector, status)
  where due_date is not null and status <> 'archived';

create index if not exists idx_obligation_instances_calendar_active
  on public.obligation_instances (organization_id, technical_due_date, status, template_id)
  where superseded_by_instance_id is null and status <> 'cancelada';
