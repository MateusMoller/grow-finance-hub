# Data Model: User Permissions

## Canonical Values

### Primary Role

- `admin`
- `colaborador`
- `cliente`

### User Status

- `pending`
- `active`
- `suspended`
- `inactive`

### Sector

- `contabil` -> Contábil
- `fiscal` -> Fiscal
- `departamento_pessoal` -> Departamento Pessoal
- `financeiro` -> Financeiro
- `comercial` -> Comercial
- `societario` -> Societário
- `geral` -> Geral

Sector codes are fixed and validated by the backend. They are not managed through application CRUD.

## Organization User Access

One canonical access record for a user in an organization.

**Proposed table**: `organization_user_access`

| Field | Type | Rules |
|---|---|---|
| `id` | uuid | Primary key |
| `organization_id` | uuid | Required, FK to `organizations` |
| `user_id` | uuid | Required, FK to `auth.users` |
| `primary_role` | text/domain | Required canonical role |
| `status` | text/domain | Required, default `pending` |
| `sector_code` | text/domain nullable | Required only for active colaboradores |
| `requires_access_review` | boolean | Default false; true blocks unresolved migrated access |
| `created_by` | uuid nullable | Actor that created the access record |
| `updated_by` | uuid nullable | Last actor |
| `created_at` | timestamptz | Required |
| `updated_at` | timestamptz | Required |

**Constraints**:

- Unique `(organization_id, user_id)`.
- `sector_code` is one of the seven fixed values.
- Active colaborador requires non-null `sector_code`.
- Admin and cliente have null `sector_code`.
- `requires_access_review = true` prevents normal colaborador activation until reviewed.
- The final active Admin in an organization cannot be demoted, suspended, or inactivated.

**Indexes**:

- `(organization_id, primary_role, status)`
- `(organization_id, sector_code, status)`
- `(organization_id, requires_access_review)` where true

**Data API and RLS**:

- Enable RLS before application use.
- Grant authenticated users only the read capability needed for their own effective access; Admin list/mutation uses protected RPC/Edge Function contracts.
- Do not grant `anon` access.

## User Module Grant

One enabled internal module for a colaborador.

**Proposed table**: `user_module_grants`

| Field | Type | Rules |
|---|---|---|
| `id` | uuid | Primary key |
| `organization_id` | uuid | Required |
| `user_id` | uuid | Required |
| `module_key` | text | Required, from canonical module registry |
| `granted_by` | uuid nullable | Admin actor or migration actor |
| `source` | text | `admin`, `default`, or `migration` |
| `created_at` | timestamptz | Required |

**Constraints**:

- Unique `(organization_id, user_id, module_key)`.
- Grants may exist only for canonical colaboradores.
- `tarefas` must exist for each active colaborador.
- Admin access is implicit and does not require rows.
- Cliente users cannot have internal module grants.

**Indexes**:

- `(organization_id, user_id)`
- `(organization_id, module_key, user_id)`

**Data API and RLS**:

- Enable RLS and avoid direct browser writes.
- Grant only the minimum read privilege required for self-resolution; Admin mutations use the protected transaction boundary.

Revocation deletes the current grant and writes an audit entry. Grant history is preserved in the audit log rather than soft-deleting active rows.

## Client Link

Existing table: `client_users`.

| Field | Relevant behavior |
|---|---|
| `organization_id` | Tenant boundary |
| `client_id` | Linked company |
| `user_id` | Cliente user |
| `role` | Portal relationship |
| `status` | Only `active` grants access |

**Rules**:

- A cliente may have multiple active links.
- Unique `(client_id, user_id)` remains valid.
- Portal queries require an active link for the target client.
- Switching company changes the query scope; data from the prior company must not remain visible.
- `clients.portal_user_id` is compatibility data, not the canonical many-to-many authority.

**Additional index**:

- `(organization_id, user_id, status, client_id)`

## Kanban Task

Existing table: `kanban_tasks`.

**Added field**:

| Field | Type | Rules |
|---|---|---|
| `assigned_to_user_id` | uuid nullable | FK to `auth.users`; direct individual assignee |

The existing `assignee text` remains temporarily for display/backfill compatibility and must not be used for authorization.

**Rules**:

- `sector` is normalized to one fixed sector code for authorization.
- Admin sees all tasks in the organization.
- Active colaborador with `tarefas` sees a task when `sector_code` matches or `assigned_to_user_id = user_id`.
- A direct assignment does not expose other tasks from the assigned task's sector.
- Cliente cannot access internal Kanban tasks.

**Indexes**:

- `(organization_id, status, sector)`
- `(organization_id, assigned_to_user_id, status)`
- Preserve/request indexes required by existing task workflows.

## Permission Audit Entry

Append-only record for every access-affecting change.

**Proposed table**: `permission_audit_entries`

| Field | Type | Rules |
|---|---|---|
| `id` | uuid | Primary key |
| `organization_id` | uuid | Required |
| `actor_user_id` | uuid nullable | Null only for controlled migration/system action |
| `target_user_id` | uuid | Required |
| `action` | text/domain | Required |
| `previous_value` | jsonb | Normalized before state |
| `new_value` | jsonb | Normalized after state |
| `reason` | text nullable | Optional Admin note |
| `result` | text | `success` or `denied` |
| `created_at` | timestamptz | Required |

**Actions**:

- `user_created`
- `role_changed`
- `status_changed`
- `sector_changed`
- `module_granted`
- `module_revoked`
- `client_linked`
- `client_unlinked`
- `migration_mapped`
- `migration_review_required`
- `last_admin_change_denied`

**Rules**:

- Normal users cannot update or delete audit entries.
- Admins may list entries only within their organization.
- Sensitive values are minimized; passwords/tokens are never stored.

**Indexes**:

- `(organization_id, created_at desc)`
- `(organization_id, target_user_id, created_at desc)`
- `(organization_id, actor_user_id, created_at desc)`
- `(organization_id, action, created_at desc)`

**Data API and RLS**:

- Enable RLS.
- Admin-only organization reads; no normal client insert/update/delete grants.
- Trusted backend transaction writes audit events.

## Effective Access Projection

Resolved by a security-definer function or Admin-safe view.

```json
{
  "organization_id": "uuid",
  "user_id": "uuid",
  "status": "active",
  "primary_role": "colaborador",
  "sector_code": "fiscal",
  "enabled_modules": ["tarefas", "obrigacoes"],
  "active_client_ids": [],
  "requires_access_review": false
}
```

**Resolution**:

- Admin: all enabled organization modules, no sector restriction.
- Colaborador: explicit module grants, exactly one sector, no portal client scope.
- Cliente: no internal modules or sector; active client IDs only.
- Pending, suspended, inactive, or review-required: protected access denied.

## Relationships

```text
organizations 1---* organization_user_access *---1 auth.users
organization_user_access 1---* user_module_grants
auth.users 1---* client_users *---1 clients
auth.users 1---* kanban_tasks (assigned_to_user_id)
organization_user_access 1---* permission_audit_entries (target)
auth.users 1---* permission_audit_entries (actor)
```

## State Transitions

### User Status

```text
pending -> active
active -> suspended -> active
active -> inactive
pending -> inactive
```

- Active colaborador requires sector and Tasks grant.
- Active cliente without links may authenticate but receives the portal pending-access state.
- Suspended/inactive users receive no protected access or internal task notifications.

### Role Change

```text
admin <-> colaborador
colaborador <-> cliente
admin <-> cliente
legacy role -> canonical role
```

- Admin actor required.
- Conversion to colaborador requires sector and produces at least the Tasks grant.
- Conversion to cliente removes internal grants and sector, then applies explicit client links.
- Conversion to Admin removes sector/module dependency and grants implicit full internal access.
- Final active Admin protection is checked transactionally.

### Sector Change

```text
sector A -> sector B
```

- Changes current sector queue and future notifications.
- Does not rewrite completed task history.
- Does not remove visibility of tasks directly assigned to the user.

### Module Grant

```text
absent -> enabled -> absent
```

- `tarefas` cannot be removed while the user is an active colaborador.
- Changes apply on the next effective-access refresh or protected request.

## Migration Mapping

1. Create canonical record for each organization/user.
2. Map `admin` to Admin and `client` to Cliente.
3. Map other internal roles to Colaborador.
4. Derive deterministic sector from department role or existing trusted assignment.
5. Compute currently effective modules and insert equivalent grants.
6. Ensure Tasks grant for every colaborador.
7. Mark ambiguous users `requires_access_review = true`; do not grant broad fallback access.
8. Preserve legacy rows for compatibility until canonical consumers pass acceptance.
