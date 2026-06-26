# Implementation Plan: User Permissions

**Branch**: `004-user-permissions` | **Date**: 2026-06-25 | **Spec**: `specs/004-user-permissions/spec.md`

**Input**: Feature specification from `specs/004-user-permissions/spec.md`

## Summary

Replace the mixed legacy role model with three canonical organization roles: `admin`, `colaborador`, and `cliente`. Store a colaborador's fixed sector and explicit module grants separately from role, keep `tarefas` enabled by default for newly created colaboradores, preserve equivalent effective module access for migrated users, and continue using active `client_users` links for one-or-more-company portal access.

Authorization remains backend-owned. Supabase migrations introduce canonical access records, indexes, RLS helpers, task assignment support, audit records, and compatibility mapping. Edge Functions own privileged user mutations and last-Admin protection. React consumes one effective-access contract for navigation, route guards, user management, task queues, and portal company selection.

## Technical Context

**Language/Version**: TypeScript 5.8, React 18.3, Deno TypeScript for Supabase Edge Functions, PostgreSQL 15+ through Supabase

**Primary Dependencies**: Vite 8, React Router 6, TanStack Query 5, Supabase JS 2, shadcn/Radix, React Hook Form, Zod, Vitest

**Storage**: Supabase PostgreSQL, Supabase Auth, existing `client_users`, `kanban_tasks`, `operational_audit_logs`, and organization tables

**Testing**: Vitest, React Testing Library, SQL/RLS migration validation, Edge Function contract tests or local invocation, `npm run lint`, `npm run test`, `npm run build`

**Target Platform**: Modern desktop/mobile web browsers; Supabase-hosted PostgreSQL and Edge Functions

**Project Type**: Vite single-page web application with Supabase backend

**Performance Goals**: Filter and paginate at least 500 users and 2,000 open tasks; permission changes effective within 60 seconds or next protected request; common access checks backed by indexed predicates

**Constraints**: Exactly three canonical roles; exactly one sector for each active colaborador; fixed sector values; Admin always has all internal modules; Tasks is the only default module for new colaboradores; client access requires active explicit links; direct task assignment grants access only to that task

**Scale/Scope**: Internal app, user administration, task/Kanban flows, notifications, client portal, reports that expose role data, shared authorization helpers, affected Edge Functions and RLS policies

**Affected Surfaces**: Internal app, client portal, Supabase database, RLS, Edge Functions, task notifications, reports, audit logs; public site and Storage are not functionally changed

**Security/Tenant Scope**: Every access record is organization-scoped. Admin mutations validate JWT and Admin membership in the requested organization. Cliente reads are constrained by active `client_users` links. RLS enforces module, sector, direct-assignment, and client boundaries.

**Business Rule Owner**: PostgreSQL constraints/functions/RLS own effective authorization and task visibility; `create-team-user` and `manage-team-user` own privileged lifecycle mutations; frontend hooks and route guards only reflect resolved access

**Observability/Rollback**: Permission mutations append structured audit entries. Migration includes preflight reports for unmapped sectors/modules, compatibility reads during rollout, preserved legacy role rows until acceptance, and feature-flag rollback of new enforcement without widening client access

## Constitution Check

*GATE: Passed before research and re-checked after design.*

### Security and Least Privilege

- [x] Public, internal, and client-portal surfaces remain separated by route, role, and backend authorization.
- [x] No secrets or service-role credentials are exposed to client code or logs.
- [x] Privileged Edge Functions validate JWT, organization, Admin role, action, and input before service-role operations.

### Tenant Isolation and Data Segregation

- [x] Canonical access, module grants, sector assignments, task checks, and audit entries are organization-aware.
- [x] Client portal flows use active `client_users` links and support multiple explicitly linked companies.
- [x] RLS and helper functions are included for all affected tables; Storage is unchanged.

### Backend-Owned Business Rules

- [x] Role changes, last-Admin protection, module grants, sector requirements, migration mapping, and task authorization live in PostgreSQL/Edge Functions.
- [x] Frontend logic is limited to forms, presentation, filtering controls, and safe route feedback.

### Scalable Frontend and Data Access

- [x] Effective access and Admin user lists use TanStack Query with targeted invalidation.
- [x] Independent user-detail datasets may load concurrently after authorization.
- [x] User/task lists use server pagination/filtering and indexed access predicates; module membership uses `Set`.
- [x] Public routes receive no new internal dependencies.

### Auditability, Reliability, and Operability

- [x] Permission changes record actor, organization, target, action, previous value, new value, and result.
- [x] Sensitive failures deny the mutation and return controlled error codes.
- [x] Validation commands are `npm run lint`, `npm run test`, and `npm run build`, plus Supabase migration/RLS checks.
- [x] Rollout preserves legacy access until canonical mapping is validated; rollback does not weaken portal isolation.

## Project Structure

### Documentation

```text
specs/004-user-permissions/
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   |-- access-control-contract.md
|   |-- task-sector-routing-contract.md
|   `-- user-management-contract.md
`-- tasks.md
```

### Source Code

```text
src/
|-- App.tsx
|-- components/
|   |-- app/
|   `-- ui/
|-- hooks/
|   `-- useAuth.tsx
|-- integrations/supabase/
|-- lib/
|   |-- accessControl.ts
|   `-- taskSectorAccess.ts
|-- pages/
|   |-- UsuariosPage.tsx
|   |-- KanbanPage.tsx
|   `-- PortalClientePage.tsx
`-- test/

supabase/
|-- functions/
|   |-- create-team-user/
|   |-- manage-team-user/
|   |-- ensure-client-portal-profile/
|   `-- _shared/
`-- migrations/
```

**Structure Decision**: Extend the existing Vite/Supabase application. Do not add a new service or authorization framework. Centralize canonical role/module/sector constants and effective-access types in shared frontend/backend modules where runtime boundaries permit, while PostgreSQL remains authoritative.

## Phase 0: Research Decisions

1. Use three canonical roles and separate sector/module dimensions.
2. Represent the fixed sectors by stable ASCII codes with Portuguese display labels.
3. Store one organization user-access record per user and explicit module grant rows.
4. Treat Tasks as an invariant grant for active colaboradores; other grants are Admin-controlled.
5. Preserve migrated users' effective module access and flag unresolved mappings for Admin review.
6. Extend task RLS to allow Admin, matching sector, or direct assignee, while still requiring Tasks module access for colaboradores.
7. Reuse `client_users` as the many-to-many cliente/company boundary.
8. Use transactional backend mutations with structured permission audit entries.

See `specs/004-user-permissions/research.md`.

## Phase 1: Data And Contract Design

### Database

- Add canonical access status/role/sector structures scoped by `organization_id`, enable RLS, and declare explicit minimum Data API `GRANT`s instead of relying on default privileges.
- Add module grant records with unique `(organization_id, user_id, module_key)`.
- Add a typed direct-assignee UUID to `kanban_tasks` while retaining legacy display text during migration.
- Add effective-access, module-access, task-access, and last-Admin helper functions.
- Add indexes for user management filters, module lookup, active client links, task sector, direct assignee, and audit history.
- Update RLS for user access, grants, task records/comments, and audit reads.
- Backfill canonical roles, sectors, and equivalent module grants; unmapped records remain blocked for review rather than receiving broad access.

### Backend

- Keep `verify_jwt = true` and refactor `create-team-user` and `manage-team-user` into transactional canonical access mutations that derive the caller from the user JWT before any service-role operation.
- Validate fixed sector codes and module keys server-side.
- Apply Tasks automatically for new colaboradores.
- Preserve all internal modules for Admin without grant rows.
- Manage cliente links as an explicit set and never infer cross-client access.
- Emit audit entries for role, status, sector, module, and client-link changes.

### Frontend

- Update auth resolution and `ProtectedRoute` feature checks to use effective access.
- Rebuild user management around role, status, sector, module grants, and linked companies.
- Use server-filtered/paginated TanStack Query resources.
- Update Kanban filtering and notifications for sector plus direct assignment.
- Add linked-company switching in the portal without caching data across client scopes.
- Update reports to expose canonical role, sector, and modules without relying on legacy role rows.

### Contracts

The contracts define:

- effective access resolution and denial reasons;
- Admin-owned user list/create/update/deactivate/audit operations;
- task visibility and notification routing for sector or direct assignment.

## Rollout Strategy

1. Deploy additive schema, explicit Data API grants, RLS policies, helper functions, indexes, and audit support.
2. Run migration preflight and export unresolved user mappings.
3. Backfill canonical access records and equivalent module grants while retaining legacy roles.
4. Deploy Edge Functions with compatibility reads and canonical writes.
5. Deploy frontend effective-access consumption and Admin UI.
6. Enable canonical RLS for tasks and modules after acceptance checks.
7. Remove legacy role-based authorization only in a later cleanup migration.

## Rollback Strategy

- Keep legacy `user_roles` rows untouched during this feature rollout.
- Feature-flag canonical internal enforcement back to compatibility resolution if required.
- Never roll back active `client_users` portal isolation.
- Retain audit entries and migration review records.
- Reverse additive task-assignee and grant tables only after reverting all consumers; do not drop populated data in an emergency rollback.

## Post-Design Constitution Re-check

All gates remain passed. No constitution exceptions or additional dependencies are required.

## Complexity Tracking

No constitution violations require justification.
