# Research: User Permissions

## Decision: Separate Role, Sector, And Module Access

Use `admin`, `colaborador`, and `cliente` as the only canonical roles. Store sector and module access independently.

**Rationale**: Existing roles mix hierarchy (`manager`), function (`commercial`), and department (`fiscal`). Separating dimensions makes access testable and allows sector changes without changing identity or unrelated modules.

**Alternatives considered**:

- Keep legacy roles: rejected because authorization remains ambiguous.
- Create one role per permission combination: rejected due role explosion.
- Store permissions only in the frontend: rejected because direct database and Edge Function access must be protected.

## Decision: Use Fixed Sector Codes

Use these immutable codes and labels:

| Code | Label |
|---|---|
| `contabil` | Contábil |
| `fiscal` | Fiscal |
| `departamento_pessoal` | Departamento Pessoal |
| `financeiro` | Financeiro |
| `comercial` | Comercial |
| `societario` | Societário |
| `geral` | Geral |

**Rationale**: Stable ASCII codes avoid accent/casing mismatches already visible across task and integration code. Labels remain localized for the UI.

**Alternatives considered**:

- Admin-managed sector table: rejected by clarification.
- Free text: rejected because task routing and RLS require deterministic values.
- PostgreSQL enum only: viable, but a check constraint/domain plus shared constants is easier to evolve in a controlled migration.

## Decision: Canonical Organization Access Record

Introduce one organization-scoped access record per user containing canonical role, status, and nullable sector.

**Rationale**: `user_roles` permits multiple rows and represents historical role semantics. A unique canonical record removes conflicting active roles and supports status/sector validation.

**Alternatives considered**:

- Rewrite `user_roles` in place: rejected because many policies and functions depend on the existing enum.
- Put fields only on global `profiles`: rejected because access must remain organization-scoped.

## Decision: Explicit Module Grants With Tasks Invariant

Store enabled module keys as rows unique by organization, user, and module. New active colaboradores receive `tarefas`; all other modules require Admin grants. Admins do not need grant rows.

**Rationale**: Rows are indexable, auditable, and easier to query than mutable JSON. Treating Tasks as a backend invariant ensures every colaborador can use sector-routed work.

**Alternatives considered**:

- JSON array on the user record: rejected due weaker constraints and audit diffs.
- Modules derived from sector: rejected because Admins must control modules individually.
- No default modules: rejected by clarification.

## Decision: Preserve Effective Legacy Access During Migration

Map each existing internal user's currently effective route/module access to explicit grants. Department roles seed sectors where deterministic. Any unresolved sector or module mapping is flagged for Admin review and denied broader access.

**Rationale**: This minimizes disruption without converting uncertainty into excess privilege.

**Proposed role mapping**:

- `admin` -> `admin`
- `client` -> `cliente`
- all other internal roles -> `colaborador`

**Deterministic sector seeds**:

- `contabil` -> `contabil`
- `fiscal` -> `fiscal`
- `departamento_pessoal` -> `departamento_pessoal`
- `commercial` -> `comercial`
- `employee` -> `geral`
- other legacy internal roles require an existing deterministic signal or Admin review

**Alternatives considered**:

- Give all modules to migrated colaboradores: rejected as privilege escalation.
- Give Tasks only: rejected because it removes current access.
- Hard cutover and delete legacy rows: rejected due rollback and compatibility risk.

## Decision: Task Access Is Sector Or Direct Assignment

For active colaboradores with the Tasks module, a task is visible when its normalized sector equals the user's sector or its typed assignee UUID equals the user. Admins can access all organization tasks. Clientes cannot access internal tasks.

**Rationale**: Direct assignment is an explicit exception for one task and must not expose the rest of another sector.

**Alternatives considered**:

- Sector only: rejected by clarification.
- Direct assignment only: rejected because sector is the default operational queue.
- Add a second user sector: rejected because colaboradores have exactly one primary sector.

## Decision: Add Typed Task Assignee Identity

Add `assigned_to_user_id uuid` to `kanban_tasks`, retaining the existing free-text `assignee` temporarily for display/backfill compatibility.

**Rationale**: Authorization cannot safely depend on a name string. UUID identity enables indexed RLS and stable reassignment.

**Alternatives considered**:

- Match `assignee` against display name/email: rejected due collisions and renames.
- Create a many-assignee join table immediately: rejected because the requirement is a direct individual assignment and current UX appears singular.

## Decision: Reuse Active Client Links For Multiple Companies

Continue using `client_users` as the many-to-many relationship between cliente users and companies. Only `status = 'active'` links grant access.

**Rationale**: The table and tenant-aware helper already exist and support multiple client rows per user.

**Alternatives considered**:

- Use `clients.portal_user_id` as the primary model: rejected because it is one-to-one and retained only as legacy compatibility.
- Store client IDs in user metadata: rejected because RLS cannot trust mutable Auth metadata for tenant authorization.

## Decision: Transactional Admin Mutations

Privileged user changes are performed through Admin-only Edge Functions or security-definer RPCs that validate JWT, organization, current Admin status, fixed values, and last-Admin safety, then update access and audit records atomically.

**Rationale**: The current page writes some role changes directly. Canonical multi-table updates need one authoritative transaction boundary.

**Alternatives considered**:

- Multiple browser mutations: rejected because partial failures can leave invalid access.
- Service-role operations without caller revalidation: rejected by the constitution.

## Decision: Structured Permission Audit

Create a dedicated append-only permission audit record, or a strongly typed permission event in `operational_audit_logs`, with actor, organization, target, action, old value, new value, result, and timestamp.

**Rationale**: Generic metadata-only entries are insufficient for reliable filtering and before/after review.

**Alternatives considered**:

- Browser logs: rejected because they are incomplete and mutable.
- Audit only role changes: rejected because modules, sectors, status, and client links change effective access.

## Decision: Indexed Server-Side Resolution

Use indexed predicates for `(organization_id, user_id)`, module grants, active client links, task sector, direct assignee, and audit chronology. User management uses server-side filters and pagination through an Admin-only RPC.

**Rationale**: This supports the specified 500-user and 2,000-open-task scale without downloading broad datasets or repeatedly scanning arrays in React.

**Alternatives considered**:

- Load all users/tasks and filter in React: rejected for privacy and scaling.
- Cache authorization indefinitely in JWT claims: rejected because changes must take effect within 60 seconds or next request.

## Decision: Explicit Data API Grants And JWT Verification

Every new `public` table enables RLS and declares only the `authenticated` privileges required by its consumers. Permission audit and canonical access writes remain behind Admin-owned functions. User-facing Edge Functions keep `verify_jwt = true` and validate the user JWT before using service-role access.

**Rationale**: Current Supabase platform behavior no longer guarantees that new public tables are exposed to the Data API automatically. Grants and RLS are separate controls, and privileged Edge Function handlers still need application authorization after platform JWT verification.

**Alternatives considered**:

- Depend on project default privileges: rejected because defaults changed in 2026 and vary by project configuration.
- Grant broad CRUD to `authenticated`: rejected because role-level grants must be minimal and RLS is not a substitute for table privileges.
- Disable JWT verification for user-management functions: rejected because these are authenticated sensitive operations.

## Rollout And Rollback

**Rollout**:

1. Add canonical tables/columns/functions without removing legacy structures.
2. Generate a preflight report for ambiguous users and modules.
3. Backfill deterministic records and equivalent grants.
4. Deploy canonical writes with legacy-compatible reads.
5. Deploy frontend consumers.
6. Enable stricter RLS after acceptance.

**Rollback**:

1. Keep legacy `user_roles` through the rollout.
2. Disable canonical internal enforcement through a controlled feature flag if access is incorrectly blocked.
3. Preserve `client_users` isolation and audit data.
4. Do not drop additive data until all consumers are reverted and the migration is confirmed unused.
