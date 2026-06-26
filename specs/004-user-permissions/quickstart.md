# Quickstart: User Permissions

## Goal

Validate the canonical three-role model, fixed sectors, module grants, direct task assignment, multiple client links, auditability, and migration safety.

## Preconditions

- At least two active Admin users for last-Admin tests.
- Test users for colaborador and cliente.
- Test clients in the same organization.
- Tasks in at least Fiscal and Financeiro.
- Modules `tarefas`, `clientes`, and `obrigacoes` available.
- Fixed sectors: Contábil, Fiscal, Departamento Pessoal, Financeiro, Comercial, Societário, Geral.

## 1. New Colaborador Defaults

1. Sign in as Admin and create an active colaborador in Fiscal.
2. Do not select additional modules.
3. Confirm saved access contains `tarefas` only.
4. Sign in as the colaborador.
5. Confirm Tasks is available and unrelated modules are hidden.
6. Navigate directly to a disabled module and confirm backend denial.

## 2. Module Grant And Revocation

1. Grant `obrigacoes` to the colaborador.
2. Confirm the audit record contains actor, target, prior modules, new modules, and timestamp.
3. Refresh the colaborador session and confirm access.
4. Revoke `obrigacoes`.
5. Confirm the next protected request is denied and the audit record is appended.
6. Attempt to remove `tarefas` from the active colaborador and confirm the backend rejects or restores the invariant.

## 3. Sector And Direct Task Assignment

1. Keep the colaborador in Fiscal.
2. Create one Fiscal task and two Financeiro tasks.
3. Assign one Financeiro task directly to the colaborador.
4. Confirm the colaborador sees the Fiscal task and assigned Financeiro task only.
5. Confirm the other Financeiro task remains inaccessible by list and direct URL/API.
6. Remove the direct assignment and confirm access disappears.
7. Change the colaborador sector to Financeiro and confirm the Financeiro queue becomes visible without rewriting completed task history.

## 4. Notification Routing

1. Trigger events for a sector task and a cross-sector directly assigned task.
2. Confirm the colaborador receives both relevant notifications exactly once.
3. Confirm unrelated sector events are skipped.
4. Suspend the colaborador and confirm no further internal task notifications are delivered.

## 5. Cliente With Multiple Companies

1. Create or update a cliente with two active client links.
2. Confirm no internal modules or sector remain.
3. Sign in through the portal and switch between the two companies.
4. Confirm every query/action is scoped to the selected linked company.
5. Attempt a third unlinked client ID and confirm denial.
6. Revoke one link and confirm the other remains available while the revoked company disappears immediately.
7. Revoke all links and confirm the safe pending-access state.

## 6. Last Admin Protection

1. Reduce the organization to one active Admin in a test environment.
2. Attempt role conversion, suspension, inactivation, and deletion.
3. Confirm each change is denied atomically and audited.
4. Add another active Admin and repeat one role conversion.
5. Confirm it now succeeds and one active Admin remains.

## 7. Migration Acceptance

1. Run preflight and list all legacy users, mapped canonical roles, sectors, and effective modules.
2. Confirm Admin and client mappings.
3. Confirm department roles map to fixed sector codes.
4. Confirm migrated colaboradores retain equivalent module grants and include Tasks.
5. Confirm ambiguous mappings are marked `requires_access_review` and do not receive broad access.
6. Confirm legacy role rows remain available during compatibility rollout.
7. Compare task and portal access before/after for representative users.

## 8. Scale And Isolation

1. Test Admin user listing with at least 500 records using server filters and pagination.
2. Test task listing with at least 2,000 open tasks and verify indexed sector/direct-assignee access.
3. Verify an Admin from another organization cannot list or mutate users.
4. Verify a cliente cannot query internal access, grants, tasks, or audit records.
5. Verify new tables have explicit intended `GRANT`s and return permission errors for roles that were not granted access.

## Validation Commands

```powershell
npm run lint
npm run test
npm run build
npx supabase db lint
```

When a linked Supabase validation environment is available, apply migrations there, regenerate types, run database advisors, confirm `verify_jwt = true` for user-management functions, and run RLS/Edge Function acceptance checks before production rollout.

## Rollback Drill

1. Disable canonical internal enforcement through the rollout feature flag.
2. Confirm legacy internal users still resolve without changing client portal boundaries.
3. Confirm `client_users` isolation remains active.
4. Confirm canonical and audit data remain intact for investigation.

## Final Acceptance Evidence - 2026-06-26

The quickstart scenarios were approved through automated contract coverage plus a local Supabase validation run.

### Scenario Coverage

- New colaborador defaults, module grant/revocation, Tasks invariant, and final-Admin denial are covered by `src/test/UsuariosPage.permissions.test.tsx`, `src/test/userPermissions.test.ts`, `supabase/functions/tests/team-user-permissions-test.ts`, and `supabase/tests/user_permissions_foundation.sql`.
- Sector routing, direct assignment, reassignment behavior, task comments, notification eligibility, inactive/review-required denial, and 2,000-task scale are covered by `src/test/taskSectorRouting.test.ts` and `supabase/tests/user_permissions_task_access.sql`.
- Cliente multi-company scope, revoked-link fallback, pending access, selected-client query keys, and cross-client denial are covered by `src/test/clientPortalPermissions.test.ts` and `supabase/tests/user_permissions_client_scope.sql`.
- Permission audit completeness, before/after rendering, filters, pagination, append-only storage, and non-Admin denial are covered by `src/test/permissionAudit.test.tsx` and `supabase/tests/user_permissions_audit.sql`.

### Validation Commands

- `npm run lint`: passed.
- `npm run test`: passed, 25 files and 67 tests.
- `npm run build`: passed with the existing Vite chunk-size warning.
- `npm run verify:deploy`: passed.
- `npx supabase migration list --local`: passed and confirmed migrations through `20260625131633`.
- `npx supabase test db --local supabase/tests`: passed, 4 files and 55 pgTAP tests.
- `npx supabase db lint --local --level warning`: executed; returned two legacy cashflow errors outside this feature.
- `npx supabase db advisors --local --type all`: executed; returned pre-existing warning-level advisor findings outside this feature acceptance.

### Rollout And Rollback Drill

- Rollout path remains additive: canonical tables, grants, helpers, task assignment, audit API, backend functions, and frontend consumers are deployed without deleting legacy `user_roles`.
- Rollback path remains available through the documented canonical-enforcement feature flag while preserving `client_users` portal isolation.
- Canonical access and `permission_audit_entries` are retained during rollback for investigation.
- Final approval note: no quickstart item remains open after the 2026-06-26 validation pass; production rollout still requires applying the committed migrations/functions to the target Supabase project and verifying environment-specific secrets/configuration.
