# Contract: Effective Access Resolution

## Purpose

Provide one organization-aware authorization result for navigation, RLS helpers, protected actions, task routing, and portal scope.

## Request

The authenticated JWT supplies `user_id`. The caller supplies or resolves `organization_id`; a target module, client, task, or action is optional.

```json
{
  "organization_id": "uuid",
  "module_key": "tarefas",
  "client_id": null,
  "task_id": null,
  "action": "read"
}
```

## Effective Access Response

```json
{
  "ok": true,
  "user_id": "uuid",
  "organization_id": "uuid",
  "status": "active",
  "primary_role": "admin | colaborador | cliente",
  "sector_code": "fiscal",
  "enabled_modules": ["tarefas", "obrigacoes"],
  "active_client_ids": [],
  "requires_access_review": false
}
```

## Rules

- Admin receives all enabled internal modules and user-management permission.
- Colaborador receives explicit grants; active colaboradores always include `tarefas`.
- Cliente receives no internal modules and only active linked client IDs.
- A review-required, pending, suspended, or inactive user is denied.
- Navigation visibility and protected backend authorization consume the same semantics.
- Authorization is re-evaluated on protected requests and is not trusted solely from long-lived browser state.

## Denial

```json
{
  "ok": false,
  "code": "missing_access_record | inactive_user | review_required | admin_required | module_disabled | sector_mismatch | client_scope_denied | task_scope_denied | pending_client_link",
  "safe_redirect": "/app | /app/tarefas | /app/portal",
  "message": "Safe user-facing explanation"
}
```

## Security Requirements

- The function derives user identity from JWT, never request body.
- Organization membership is validated before returning details.
- Cliente users cannot inspect module grants, sectors, or internal user records.
- Non-Admins cannot enumerate another user's effective access.
- Service-role callers must still validate actor and intended organization.

## Acceptance Checks

- New colaborador resolves with `tarefas` and no other module unless explicitly granted.
- Admin resolves with all internal modules without module grant rows.
- Cliente with two active links resolves exactly those two client IDs.
- Revoking a module or client link changes the next protected result.
- Review-required migration records fail closed.
