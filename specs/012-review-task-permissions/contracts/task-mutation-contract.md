# Contract: Canonical Task Mutations

## Human mutation request

```json
{
  "action": "task.change_status",
  "organizationId": "uuid",
  "taskId": "uuid",
  "expectedVersion": 7,
  "changes": {
    "status": "doing"
  },
  "correlationId": "uuid"
}
```

Authentication is taken from the bearer token, never from a user id in the body.

## Success response

```json
{
  "ok": true,
  "task": {},
  "capabilities": ["task.read", "task.update_content", "task.change_status"],
  "auditId": "uuid",
  "correlationId": "uuid"
}
```

## Denied response

HTTP 403 for authenticated callers without capability. Missing and inaccessible task identifiers use the same safe payload.

```json
{
  "ok": false,
  "code": "task_not_available",
  "message": "A tarefa não está disponível para esta ação.",
  "correlationId": "uuid"
}
```

## Conflict response

HTTP 409 when `expectedUpdatedAt` no longer matches or transition is stale.

## Batch request

```json
{
  "action": "task.change_status",
  "organizationId": "uuid",
  "items": [
    { "taskId": "uuid", "expectedUpdatedAt": "ISO-8601", "changes": { "status": "archived" } }
  ],
  "correlationId": "uuid"
}
```

Batch requests accept at most 100 items. The backend validates permission, input and `expectedVersion` for every item before the first mutation. If any item is denied, invalid or stale, the whole request fails and no item is changed; callers must not infer inaccessible task content.

## System mutation context

Internal helper only:

```json
{
  "actorKind": "system",
  "actorSource": "grow_obligations",
  "organizationId": "uuid",
  "taskId": "uuid",
  "action": "task.change_status",
  "technicalLink": { "instanceId": "uuid" },
  "idempotencyKey": "string",
  "changes": { "status": "review" }
}
```

Allowed sources and required technical links are defined server-side. The caller cannot self-declare an arbitrary trusted source.

## Field allowlists

- `task.update_content`: title, description, priority, due_date, tags
- `task.manage_subtasks`: subtasks
- `task.change_status`: status only
- `task.assign`: assigned_to_user_id and derived assignee label
- `task.change_sector`: sector plus validated assignment consequences
- `task.change_client`: canonical client reference/label
- integration fields and organization_id: never accepted from generic human mutation

## Atomic guarantees

1. Authenticate and load canonical access.
2. Lock current task row.
3. Authorize action against current state.
4. Validate field allowlist and transition.
5. Execute required integration synchronization.
6. Update task.
7. Insert success audit.
8. Commit or roll back all steps.

## Logical deletion and retention

- `task.delete` is a logical deletion that records `deleted_at`, `deleted_by` and the audit event in the same transaction.
- Operational reads exclude logically deleted tasks by default.
- `task.restore` is administrator-only and is available during the one-year retention period.
- Physical purge is not exposed by this endpoint; it runs as a separate audited administrative routine after one year.
