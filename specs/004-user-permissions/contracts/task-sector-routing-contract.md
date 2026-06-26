# Contract: Task Sector And Direct Assignment

## Purpose

Define task visibility, mutation, and notification rules for Admins and colaboradores.

## Fixed Sectors

`contabil`, `fiscal`, `departamento_pessoal`, `financeiro`, `comercial`, `societario`, `geral`

## Task Access Inputs

- Authenticated user and organization
- Effective role, status, sector, and `tarefas` module access
- Task organization, normalized sector, and `assigned_to_user_id`
- Requested action

## Visibility Rule

```text
active Admin in organization
OR
(
  active colaborador
  AND tarefas module enabled
  AND (
    task.sector = colaborador.sector
    OR task.assigned_to_user_id = colaborador.user_id
  )
)
```

Cliente users never receive internal task access.

## List Request

```json
{
  "status": "open | completed | all",
  "sector": "current | all | fixed-sector-code",
  "assigned": "any | me | unassigned",
  "client_id": "uuid | all",
  "page": 1,
  "page_size": 50
}
```

The requested filters may narrow results but never widen RLS.

## Response Item

```json
{
  "task_id": "uuid",
  "title": "Task title",
  "sector_code": "fiscal",
  "assigned_to_user_id": "uuid",
  "client_id": "uuid",
  "status": "backlog",
  "access_source": "admin | sector | direct_assignment",
  "due_at": "timestamp"
}
```

## Mutation Rules

- Admin may create, assign, reassign, update, and delete organization tasks.
- Colaborador task mutations require Tasks access and current visibility.
- Direct assignment to a colaborador in another sector is valid and grants only that task.
- Reassignment immediately removes the prior assignee's direct-assignment access unless sector access still applies.
- Changing the task sector recomputes sector access without changing historical audit attribution.
- The free-text legacy `assignee` field is not an authorization input.

## Notification Event

```json
{
  "event_type": "task_created | task_assigned | task_updated | task_due | task_overdue",
  "organization_id": "uuid",
  "task_id": "uuid",
  "sector_code": "fiscal",
  "assigned_to_user_id": "uuid",
  "module_key": "tarefas"
}
```

## Recipient Rules

- Sector recipients are active colaboradores in the task sector with Tasks access.
- A direct assignee is included even when their sector differs.
- Recipients are deduplicated by user ID.
- Suspended, inactive, cliente, review-required, or Tasks-disabled users are skipped.
- A direct assignee does not become a recipient for other tasks in that sector.

## Acceptance Checks

- Fiscal colaborador sees Fiscal tasks.
- Fiscal colaborador directly assigned a Financeiro task sees that task only from Financeiro.
- Removing direct assignment removes access unless sector still matches.
- Removing Tasks access blocks task list, direct access, comments, and notifications.
- Task comments use the same task-access predicate as the parent task.
