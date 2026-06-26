# Tasks: User Permissions

**Input**: Design documents from `specs/004-user-permissions/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Targeted automated tests are included because this feature changes authentication boundaries, RLS, privileged mutations, task visibility, client isolation, and auditability.

**Organization**: Tasks are grouped by user story so each increment can be implemented and validated independently after the shared foundation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it targets separate files and has no dependency on an incomplete task
- **[Story]**: Maps the task to User Story 1, 2, 3, or 4
- Migration tasks must create files with `npx supabase migration new <name>` before editing the generated path

---

## Phase 1: Setup

**Purpose**: Capture the current authorization surface and define canonical registries before schema work.

- [X] T001 Inventory legacy roles, route feature keys, task producers, client-link flows, and deployed/local Edge Function auth differences in `specs/004-user-permissions/implementation-notes.md`
- [X] T002 [P] Define the canonical role, fixed sector, user status, and module-key registries in `src/lib/userPermissions.ts`
- [X] T003 [P] Add rollout feature-flag defaults for canonical permission resolution in `src/lib/organizationFeatures.ts`

---

## Phase 2: Foundational

**Purpose**: Add the organization-scoped access model and shared authorization primitives required by every user story.

**CRITICAL**: No user story implementation begins until this phase passes migration and access-resolution tests.

- [X] T004 Run `npx supabase migration new user_permissions_foundation` and implement `organization_user_access`, `user_module_grants`, `permission_audit_entries`, constraints, tenant indexes, RLS enablement, and explicit minimum Data API grants in the generated `supabase/migrations/<timestamp>_user_permissions_foundation.sql`
- [X] T005 Run `npx supabase migration new user_permissions_access_helpers` and implement effective-access, Admin, module, fixed-sector, active-client-link, and last-active-Admin helper functions with revoked `PUBLIC` execution in the generated `supabase/migrations/<timestamp>_user_permissions_access_helpers.sql`
- [X] T006 Run `npx supabase migration new user_permissions_legacy_backfill` and implement deterministic canonical role/sector mapping, equivalent module-grant backfill, mandatory `tarefas` grants, review flags, migration audit events, and preservation of `user_roles` in the generated `supabase/migrations/<timestamp>_user_permissions_legacy_backfill.sql`
- [X] T007 [P] Add shared Edge Function parsing, fixed-value validation, effective-access lookup, and safe error codes in `supabase/functions/_shared/user-permissions.ts`
- [X] T008 [P] Refactor canonical role and module predicates while retaining rollout compatibility exports in `src/lib/accessControl.ts`
- [X] T009 Add the effective-access model, refresh operation, and organization switching semantics to `src/hooks/useAuth.tsx`
- [X] T010 Update module-aware internal, portal, review-required, inactive, and Admin-only routing in `src/components/app/ProtectedRoute.tsx`
- [X] T011 Update sidebar visibility to combine organization feature flags with canonical user module grants in `src/components/app/AppSidebar.tsx`
- [X] T012 Update app layout access assumptions and safe redirects for the three canonical roles in `src/components/app/AppLayout.tsx`
- [X] T013 Regenerate database types with `npx supabase gen types typescript --local` into `src/integrations/supabase/types.ts`
- [X] T014 [P] Add unit tests for fixed sectors, canonical roles, module resolution, Tasks defaulting, and compatibility mapping in `src/test/userPermissions.test.ts`
- [X] T015 [P] Add SQL/RLS acceptance coverage for self access, Admin access, review-required denial, cross-organization denial, and forbidden anonymous access in `supabase/tests/user_permissions_foundation.sql`

**Checkpoint**: Canonical access resolves safely for migrated and new users, and shared frontend/backend consumers can use it.

---

## Phase 3: User Story 1 - Admin Manages Users And Access (Priority: P1) MVP

**Goal**: An Admin can list, create, edit, activate, suspend, and deactivate users; set canonical role and colaborador sector; grant modules; and never remove the final active Admin.

**Independent Test**: Sign in as Admin, create a colaborador with no optional modules, verify `tarefas` is the only default, grant and revoke another module, verify direct access changes, and confirm non-Admins and final-Admin mutations are denied.

### Tests

- [X] T016 [P] [US1] Add Edge Function contract tests for authentication, organization scope, canonical values, Tasks defaulting, atomic updates, and final-Admin denial in `supabase/functions/tests/team-user-permissions-test.ts`
- [X] T017 [P] [US1] Add React integration tests for Admin listing, filters, create/edit role-specific fields, denied state, and mutation refresh in `src/test/UsuariosPage.permissions.test.tsx`

### Implementation

- [X] T018 [US1] Run `npx supabase migration new user_permissions_admin_api` and implement paginated Admin-only user listing plus transactional create/update/status/module RPCs in the generated `supabase/migrations/<timestamp>_user_permissions_admin_api.sql`
- [X] T019 [US1] Refactor user creation to validate the user JWT and organization, call the canonical transaction, apply `tarefas` by default, and return the effective-access contract in `supabase/functions/create-team-user/index.ts`
- [X] T020 [US1] Refactor update/deactivate/delete actions to use canonical transactions, preserve final-Admin safety, revoke incompatible grants/links on role change, and return controlled errors in `supabase/functions/manage-team-user/index.ts`
- [X] T021 [US1] Confirm `verify_jwt = true` for both administrative functions and document any deployment drift in `supabase/config.toml`
- [X] T022 [US1] Replace legacy role options with Admin, colaborador, and cliente forms using fixed sector selection, module checkboxes, status controls, and role-specific validation in `src/pages/UsuariosPage.tsx`
- [X] T023 [US1] Implement server-paginated user search and filters for role, sector, status, module, client, and review flag in `src/pages/UsuariosPage.tsx`
- [X] T024 [US1] Add TanStack Query user-management resources, mutation invalidation, and bounded cache keys in `src/hooks/useUserManagement.ts`
- [X] T025 [US1] Enforce Admin-only access to the user-management route and canonical module checks for all internal routes in `src/App.tsx`
- [X] T026 [US1] Remove direct browser writes to `user_roles` and `client_users` from promotion/edit flows in `src/pages/UsuariosPage.tsx`
- [X] T027 [US1] Update user-related report fields and permission labels to canonical role, sector, status, and modules in `src/lib/reports/catalog.ts`
- [X] T028 [US1] Execute the new-colaborador, module grant/revocation, and final-Admin scenarios and record results in `specs/004-user-permissions/quickstart.md`

**Checkpoint**: User Story 1 is a deployable MVP with backend-enforced Admin governance.

---

## Phase 4: User Story 2 - Colaborador Works By Sector (Priority: P2)

**Goal**: A colaborador sees Tasks from their fixed sector plus tasks assigned directly to them, without seeing other tasks from the assignee task's sector.

**Independent Test**: Assign a Fiscal colaborador one Financeiro task and verify they see Fiscal tasks and that assigned Financeiro task only; remove the assignment and verify access disappears unless the sector matches.

### Tests

- [X] T029 [P] [US2] Add SQL/RLS tests for Admin all-task access, Tasks-module requirement, sector access, direct assignment, reassignment, comments, and cross-sector denial in `supabase/tests/user_permissions_task_access.sql`
- [X] T030 [P] [US2] Add frontend tests for sector labels, direct-assignee selection, task list/Kanban visibility, and task notifications in `src/test/taskSectorRouting.test.tsx`

### Implementation

- [X] T031 [US2] Run `npx supabase migration new user_permissions_task_assignment` and add `assigned_to_user_id`, fixed-sector validation, task indexes, typed-assignee backfill support, and canonical task-access helpers in the generated `supabase/migrations/<timestamp>_user_permissions_task_assignment.sql`
- [X] T032 [US2] Run `npx supabase migration new user_permissions_task_rls` and replace Kanban task and comment policies with Admin-or-Tasks-module-and-sector-or-direct-assignment rules in the generated `supabase/migrations/<timestamp>_user_permissions_task_rls.sql`
- [X] T033 [P] [US2] Replace legacy role-derived task-sector helpers with canonical sector and direct-assignment helpers in `src/lib/taskSectorAccess.ts`
- [X] T034 [US2] Update Kanban task types, queries, filters, and mutations to use `assigned_to_user_id` while retaining legacy assignee display during rollout in `src/pages/KanbanPage.tsx`
- [X] T035 [US2] Replace free-text responsible entry with an active-colaborador selector and fixed-sector control in `src/components/app/KanbanTaskDetailSheet.tsx`
- [X] T036 [US2] Update list task types, responsible selector, and displayed access source for sector/direct assignment in `src/pages/TarefasPage.tsx`
- [X] T037 [US2] Ensure the unified task workspace preserves list/Kanban filters and direct-assignment navigation in `src/pages/TaskWorkspacePage.tsx`
- [X] T038 [US2] Update task-derived priority notifications to select typed assignee data and rely on canonical task RLS in `src/hooks/usePriorityNotifications.ts`
- [X] T039 [US2] Normalize calendar task-sector visibility to the fixed sector registry and canonical effective access in `src/pages/CalendarioPage.tsx`
- [X] T040 [P] [US2] Update obligation-generated Kanban tasks to persist `assigned_to_user_id` when an internal user is selected in `supabase/functions/grow-obligations-module/index.ts`
- [X] T041 [P] [US2] Update chat-webhook task creation to resolve a unique internal assignee UUID when possible and fail safely on ambiguous names in `supabase/functions/conecta-chat-webhook/index.ts`
- [X] T042 [P] [US2] Update Acessorias-created Kanban tasks to preserve typed assignee and fixed sector values in `supabase/functions/acessorias-module/index.ts`
- [X] T043 [US2] Regenerate task column types after the assignment migrations in `src/integrations/supabase/types.ts`
- [X] T044 [US2] Execute sector, direct-assignment, reassignment, notification, and 2,000-task scale scenarios and record results in `specs/004-user-permissions/quickstart.md`

**Checkpoint**: User Story 2 independently enforces task access in RLS and presents the same scope in list, Kanban, calendar, and notifications.

---

## Phase 5: User Story 3 - Cliente Accesses Only Client Scope (Priority: P3)

**Goal**: A cliente can use portal surfaces for one or more explicitly linked active companies and cannot access internal modules or unlinked clients.

**Independent Test**: Link a cliente to two clients, switch companies, verify scoped data, revoke one link, verify the other remains, then revoke all links and verify the pending-access state.

### Tests

- [X] T045 [P] [US3] Add SQL/RLS tests for multiple active links, revoked links, unlinked client denial, cross-organization denial, and internal table denial in `supabase/tests/user_permissions_client_scope.sql`
- [X] T046 [P] [US3] Add portal integration tests for company switching, scoped query keys, revoked-link removal, pending access, and internal route denial in `src/test/clientPortalPermissions.test.tsx`

### Implementation

- [X] T047 [US3] Extend canonical Admin mutations to accept an explicit linked-client set, validate client organization ownership, and atomically activate/revoke links in `supabase/functions/manage-team-user/index.ts`
- [X] T048 [US3] Update client-portal profile reconciliation to write/read canonical `cliente` access while keeping `client_users` authoritative and `portal_user_id` compatibility-only in `supabase/functions/ensure-client-portal-profile/index.ts`
- [X] T049 [US3] Update client creation with portal access to create canonical cliente access and one active client link without granting internal modules in `supabase/functions/create-client-with-portal/index.ts`
- [X] T050 [US3] Add role-specific linked-company multi-selection and pending-access explanation to the Admin user form in `src/pages/UsuariosPage.tsx`
- [X] T051 [US3] Refactor portal company selection and data loading so every TanStack Query key includes the selected linked client ID in `src/pages/PortalClientePage.tsx`
- [X] T052 [US3] Clear or replace stale company-scoped portal state immediately when the selected client link becomes inactive in `src/pages/PortalClientePage.tsx`
- [X] T053 [P] [US3] Update Open Finance authorization to use active `client_users` links and canonical internal access without trusting `portal_user_id` in `supabase/functions/open-finance-module/index.ts`
- [X] T054 [P] [US3] Update shared AI authorization to use canonical role and active linked-client scope in `supabase/functions/_shared/ai/authorization.ts`
- [X] T055 [US3] Execute multiple-company, revoked-link, pending-access, and cross-client isolation scenarios and record results in `specs/004-user-permissions/quickstart.md`

**Checkpoint**: User Story 3 independently supports many linked companies while preserving strict portal/internal separation.

---

## Phase 6: User Story 4 - Access Changes Are Auditable (Priority: P4)

**Goal**: Admins can inspect append-only access history for role, status, sector, module, client-link, migration, and denied final-Admin changes.

**Independent Test**: Change every supported access dimension and verify chronological records show organization, actor, target, action, previous value, new value, result, reason, and timestamp while non-Admins are denied.

### Tests

- [X] T056 [P] [US4] Add SQL tests for append-only audit storage, Admin-only organization reads, denied writes, and chronological indexes in `supabase/tests/user_permissions_audit.sql`
- [X] T057 [P] [US4] Add UI tests for audit filters, before/after values, pagination, empty state, and non-Admin denial in `src/test/permissionAudit.test.tsx`

### Implementation

- [X] T058 [US4] Add transactional audit writes for create, role, status, sector, module, link, migration-review, and final-Admin denial events in `supabase/functions/_shared/user-permissions.ts`
- [X] T059 [US4] Integrate structured before/after audit events into user creation in `supabase/functions/create-team-user/index.ts`
- [X] T060 [US4] Integrate structured before/after and denied audit events into user updates, status changes, role conversions, and client-link changes in `supabase/functions/manage-team-user/index.ts`
- [X] T061 [US4] Run `npx supabase migration new user_permissions_audit_api` and implement Admin-only paginated audit query RPCs with target, actor, action, and date filters in the generated `supabase/migrations/<timestamp>_user_permissions_audit_api.sql`
- [X] T062 [US4] Add TanStack Query audit resources and filter-aware cache keys in `src/hooks/usePermissionAudit.ts`
- [X] T063 [US4] Add an audit-history view with compact before/after rendering, filters, pagination, and loading/error/empty states in `src/pages/UsuariosPage.tsx`
- [X] T064 [US4] Execute audit completeness and non-Admin denial scenarios and record results in `specs/004-user-permissions/quickstart.md`

**Checkpoint**: User Story 4 provides an independently testable security history for every permission mutation.

---

## Phase 7: Polish And Cross-Cutting Validation

**Purpose**: Complete migration safety, security review, performance verification, documentation, and release gates.

- [X] T065 [P] Document generated migration paths, legacy compatibility period, unresolved-user review procedure, and rollback switches in `specs/004-user-permissions/implementation-notes.md`
- [X] T066 [P] Update the security control inventory for canonical roles, new RLS tables, Admin functions, and task access in `docs/security/security-control-matrix.md`
- [X] T067 Review every new `SECURITY DEFINER` function for caller checks, fixed `search_path`, revoked `PUBLIC` execution, and minimum grants across `supabase/migrations/*_user_permissions_*.sql`
- [X] T068 Run `npx supabase db lint --local --level warning` and record findings/fixes in `specs/004-user-permissions/implementation-notes.md`
- [X] T069 Run `npx supabase db advisors --local --type all` and record security/performance findings in `specs/004-user-permissions/implementation-notes.md`
- [X] T070 Run `npx supabase migration list --local` and validate migration ordering in `supabase/migrations/`
- [X] T071 Run `npx supabase test db --local supabase/tests` against the SQL suites in `supabase/tests/`
- [X] T072 Regenerate final Supabase types into `src/integrations/supabase/types.ts` and verify no `GenericTable` fallback is required for new permission entities
- [X] T073 Review route-level lazy loading and confirm public, internal, and portal bundles remain separated in `src/App.tsx`
- [X] T074 Validate user listing with 500 records and task access with 2,000 open tasks, then record query plans and observed timings in `specs/004-user-permissions/implementation-notes.md`
- [X] T075 Run `npm run lint` using `package.json`
- [X] T076 Run `npm run test` using `package.json`
- [X] T077 Run `npm run build` using `package.json`
- [X] T078 Run `npm run verify:deploy` using `package.json`
- [X] T079 Complete the rollout and rollback drill and record final acceptance evidence in `specs/004-user-permissions/quickstart.md`

---

## Dependencies And Execution Order

### Phase Dependencies

- **Phase 1 Setup**: Starts immediately.
- **Phase 2 Foundation**: Depends on canonical registries from Phase 1 and blocks all stories.
- **Phase 3 US1**: Depends on Phase 2 and is the MVP.
- **Phase 4 US2**: Depends on Phase 2; can proceed alongside US1 after effective access is stable.
- **Phase 5 US3**: Depends on Phase 2; can proceed alongside US1/US2 after canonical client scope is stable.
- **Phase 6 US4**: Audit storage exists in Phase 2, but the complete story follows the mutation paths from US1 and US3.
- **Phase 7 Polish**: Depends on all stories selected for release.

### User Story Dependencies

- **US1 Admin Manages Users And Access**: No story dependency after Foundation.
- **US2 Colaborador Works By Sector**: No US1 UI dependency; requires canonical access and Tasks grants from Foundation.
- **US3 Cliente Accesses Only Client Scope**: No US2 dependency; requires canonical access and existing `client_users`.
- **US4 Access Changes Are Auditable**: Requires US1 mutation paths and US3 client-link mutation paths for complete coverage.

### Critical Ordering

1. T004-T006 establish schema and migration mapping.
2. T007-T015 establish shared resolution and tests.
3. T018 precedes T019-T020 because Edge Functions call the canonical transaction.
4. T031-T032 precede task UI work because RLS is authoritative.
5. T047 precedes linked-company Admin UI completion.
6. T058 precedes T059-T060; T061 precedes T062-T063.

---

## Parallel Opportunities

- T002 and T003 can run in parallel.
- T007, T008, T014, and T015 can run in parallel after the database contract is fixed.
- T016 and T017 can run in parallel before US1 implementation.
- T029 and T030 can run in parallel before US2 implementation.
- T040, T041, and T042 can run in parallel after the typed assignment contract exists.
- T045 and T046 can run in parallel before US3 implementation.
- T053 and T054 can run in parallel after canonical client scope exists.
- T056 and T057 can run in parallel before US4 implementation.
- T065 and T066 can run in parallel during final hardening.

## Parallel Example: User Story 2

```text
Task T029: Add SQL/RLS task-access tests in supabase/tests/user_permissions_task_access.sql
Task T030: Add frontend task-routing tests in src/test/taskSectorRouting.test.tsx
```

After task schema and RLS are complete:

```text
Task T040: Update obligation task producer in supabase/functions/grow-obligations-module/index.ts
Task T041: Update chat task producer in supabase/functions/conecta-chat-webhook/index.ts
Task T042: Update Acessorias task producer in supabase/functions/acessorias-module/index.ts
```

## Parallel Example: User Story 3

```text
Task T053: Update Open Finance scope in supabase/functions/open-finance-module/index.ts
Task T054: Update AI client scope in supabase/functions/_shared/ai/authorization.ts
```

---

## Implementation Strategy

### MVP First

1. Complete Setup and Foundation.
2. Implement US1 through T028.
3. Validate Admin governance, Tasks defaulting, module revocation, and final-Admin protection.
4. Deploy to a validation environment before changing task and portal authorization.

### Incremental Delivery

1. Foundation: additive canonical model with legacy compatibility.
2. US1: Admin user and module governance.
3. US2: sector plus direct-assignment task routing.
4. US3: multiple linked companies and strict portal scope.
5. US4: complete permission history.
6. Polish: advisors, scale tests, deployment gates, rollout drill.

### Rollback Discipline

- Do not delete legacy `user_roles` during this feature.
- Do not weaken `client_users` isolation during rollback.
- Keep canonical and audit data for investigation.
- Disable canonical internal enforcement only through the documented rollout flag after reverting affected consumers.

## Notes

- Hidden navigation is never considered authorization.
- Browser code must not write canonical permission tables directly.
- Service-role usage requires validated JWT, organization, Admin role, action, and payload.
- New `public` tables require explicit grants and RLS; do not assume Data API exposure.
- Authorization must not depend on user-editable Auth metadata.
- Commit after each phase or coherent migration/function/UI group.
