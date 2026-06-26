# Contract: User Management

## Purpose

Define Admin-only, organization-scoped user lifecycle and permission operations.

## List Users

**Actor**: Active Admin in the requested organization.

```json
{
  "search": "name or email",
  "role": "admin | colaborador | cliente | all",
  "sector_code": "fixed-sector-code | all",
  "status": "active | inactive | suspended | pending | all",
  "module_key": "module-key | all",
  "client_id": "uuid | all",
  "requires_access_review": "true | false | all",
  "page": 1,
  "page_size": 50
}
```

```json
{
  "items": [
    {
      "user_id": "uuid",
      "email": "user@example.com",
      "display_name": "Maria Silva",
      "primary_role": "colaborador",
      "status": "active",
      "sector_code": "fiscal",
      "enabled_modules": ["tarefas", "obrigacoes"],
      "linked_clients": [],
      "requires_access_review": false,
      "updated_at": "timestamp"
    }
  ],
  "page": 1,
  "page_size": 50,
  "total": 1
}
```

Filtering and pagination execute server-side.

## Create User

```json
{
  "organization_id": "uuid",
  "display_name": "Maria Silva",
  "email": "user@example.com",
  "password": "secret supplied over TLS",
  "primary_role": "colaborador",
  "status": "active",
  "sector_code": "fiscal",
  "enabled_modules": ["obrigacoes"],
  "linked_client_ids": [],
  "change_reason": "New hire"
}
```

**Normalization**:

- Backend adds `tarefas` for colaborador even when omitted.
- Admin ignores sector and explicit grants and receives full internal access.
- Cliente ignores internal modules/sector and uses the explicit linked-client set.

## Update User

Uses the same access fields, without password unless a dedicated credential-reset flow is invoked.

```json
{
  "organization_id": "uuid",
  "target_user_id": "uuid",
  "display_name": "Maria Silva",
  "primary_role": "colaborador",
  "status": "active",
  "sector_code": "contabil",
  "enabled_modules": ["tarefas", "clientes", "obrigacoes"],
  "linked_client_ids": [],
  "change_reason": "Team reassignment"
}
```

## Validation

- JWT and active Admin role are required.
- Target and actor organization must match.
- Role is exactly Admin, colaborador, or cliente.
- Sector is one of the seven fixed codes.
- Active colaborador requires sector and Tasks module.
- Cliente cannot retain internal module grants or sector.
- Admin cannot have restricted module access.
- Client IDs must belong to the organization.
- Final active Admin cannot be demoted, suspended, inactivated, or deleted.
- All multi-table changes are atomic.

## Success

```json
{
  "ok": true,
  "target_user_id": "uuid",
  "effective_access": {
    "primary_role": "colaborador",
    "status": "active",
    "sector_code": "contabil",
    "enabled_modules": ["tarefas", "clientes", "obrigacoes"],
    "active_client_ids": []
  },
  "audit_entry_ids": ["uuid"]
}
```

## Error

```json
{
  "ok": false,
  "code": "unauthenticated | admin_required | organization_mismatch | invalid_role | invalid_sector | sector_required | invalid_module | tasks_required | invalid_client_link | last_admin_blocked | review_required | conflict",
  "message": "Safe user-facing explanation"
}
```

## Deactivate Or Delete

- Prefer status `inactive` for reversible offboarding.
- Inactive users lose protected access and notifications.
- Auth deletion is a separate explicit operation and is allowed only when organization links and retention rules permit it.
- Final active Admin protection applies to both operations.

## Audit Query

```json
{
  "target_user_id": "uuid | all",
  "actor_user_id": "uuid | all",
  "action": "permission-action | all",
  "date_from": "date",
  "date_to": "date",
  "page": 1,
  "page_size": 50
}
```

Each response includes actor, target, action, normalized previous/new values, reason, result, and timestamp. Passwords, tokens, and secrets are excluded.

## Migration Contract

- Existing effective module access becomes explicit grants.
- New colaboradores receive Tasks.
- Deterministic legacy sectors are mapped to fixed codes.
- Ambiguous users are marked for review and do not receive broader fallback access.
- Legacy role rows remain during compatibility rollout.
