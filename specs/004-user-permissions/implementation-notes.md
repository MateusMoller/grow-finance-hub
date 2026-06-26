# Implementation Notes: User Permissions

## Existing Authorization Inventory

- Internal authorization currently reads multiple rows from `public.user_roles`.
- Legacy internal roles mix hierarchy and department: `admin`, `director`, `manager`, `employee`, `commercial`, `partner`, `departamento_pessoal`, `fiscal`, and `contabil`.
- Portal identity uses the legacy `client` role plus `public.client_users`; `clients.portal_user_id` remains a compatibility field.
- `ProtectedRoute`, `AppSidebar`, and `useAuth` derive access from legacy role arrays.
- Organization feature keys are defined in `src/lib/organizationFeatures.ts` and map directly to internal routes.
- User creation and updates use `create-team-user` and `manage-team-user`, but `UsuariosPage` still contains direct legacy role writes for promotion flows.

## Canonical Mapping

| Legacy value | Canonical role | Initial sector |
|---|---|---|
| `admin` | `admin` | none |
| `client` | `cliente` | none |
| `contabil` | `colaborador` | `contabil` |
| `fiscal` | `colaborador` | `fiscal` |
| `departamento_pessoal` | `colaborador` | `departamento_pessoal` |
| `commercial` | `colaborador` | `comercial` |
| `employee` | `colaborador` | `geral` |
| `director`, `manager`, `partner` | `colaborador` | review unless another trusted signal exists |

All migrated colaboradores retain equivalent effective module access and receive `tarefas`. Ambiguous mappings are marked for review and do not receive broad fallback access.

## Fixed Sectors

`contabil`, `fiscal`, `departamento_pessoal`, `financeiro`, `comercial`, `societario`, `geral`

## Task Producers And Notifications

- Browser task creation/update: `src/pages/KanbanPage.tsx` and `src/pages/TarefasPage.tsx`.
- Task detail editing: `src/components/app/KanbanTaskDetailSheet.tsx`.
- Obligation task synchronization: `supabase/functions/grow-obligations-module/index.ts`.
- Acessorias task synchronization: `supabase/functions/acessorias-module/index.ts`.
- Chat webhook task creation: `supabase/functions/conecta-chat-webhook/index.ts`.
- Priority notifications read `kanban_tasks` through `src/hooks/usePriorityNotifications.ts`; canonical task RLS must be authoritative.

## Client Scope

- `client_users` is the canonical many-to-many user/client relationship.
- Only active links grant portal access.
- `ensure-client-portal-profile`, `create-client-with-portal`, Open Finance, and shared AI authorization depend on client scope.

## Edge Function Authentication

- Local `supabase/config.toml` keeps `verify_jwt = true` for `create-team-user` and `manage-team-user`.
- Existing security documentation records deployment drift for some functions; implementation validation must compare deployed settings before release.

## Rollout

- `canonical_user_permissions` starts disabled.
- Migrations are additive and preserve `user_roles`.
- Canonical reads can fall back to legacy roles during rollout.
- Client isolation through `client_users` is never disabled.

## Generated Migrations

- `20260625125112_user_permissions_foundation.sql`
- `20260625125125_user_permissions_access_helpers.sql`
- `20260625125144_user_permissions_legacy_backfill.sql`
- `20260625130016_user_permissions_admin_api.sql`
- `20260625130745_user_permissions_task_assignment.sql`
- `20260625130753_user_permissions_task_rls.sql`
- `20260625131633_user_permissions_audit_api.sql`

## Review Procedure

1. Filter users with `requires_access_review = true` in the Admin list.
2. Assign one fixed sector.
3. Compare explicit module grants with the user's previous effective routes.
4. Save through `manage-team-user`; this clears the review flag and records audit entries.
5. Confirm direct module access and task scope before communicating activation.

## Rollback

- Keep `user_roles` and compatibility helpers during the rollout.
- Disable `canonical_user_permissions` only after reverting frontend and Edge Function consumers.
- Do not disable or widen `client_users` RLS.
- Preserve canonical access and permission audit rows for investigation.
- Do not drop `assigned_to_user_id`; older clients can ignore the additive column.

## Validation Run 2026-06-25

- `npm run lint`: passed.
- `npm run test`: passed, 23 files and 54 tests.
- Targeted permission tests: passed, 3 files and 10 tests.
- `npm run build`: passed.
- `npm run verify:deploy`: passed.
- Calendar access now uses the fixed sector registry in the UI and canonical Admin/module/sector RLS rules.
- The repository security control matrix includes canonical roles, module grants, Admin APIs, permission audit, task scope, calendar scope, and portal client links.
- Security-definer review: every new `SECURITY DEFINER` function has a fixed `search_path` and matching `REVOKE ALL ON FUNCTION ... FROM PUBLIC`.
- Supabase local validation: blocked. Docker Desktop started, but `supabase start` spent more than 12 minutes downloading images and did not reach a usable stack.
- Linked type generation: unavailable; the CLI did not return generated schema output, so `src/integrations/supabase/types.ts` was preserved.
- `supabase db lint`, advisors, migration list, and pgTAP remain pending until the local stack or linked CLI session is available.

## Validation Run 2026-06-26

- `npm run lint`: passed.
- Targeted permission tests: `npm run test -- --run src/test/userPermissions.test.ts src/test/taskSectorRouting.test.ts src/test/clientPortalPermissions.test.ts` passed.
- `npm run test`: passed, 23 files and 57 tests.
- `npm run build`: passed with the existing Vite chunk-size warning for large bundles.
- `npm run verify:deploy`: passed; it reran environment validation, lint, and build.
- `git diff --check`: passed; Git only reported CRLF normalization warnings.
- Portal company data loading now uses a TanStack Query key scoped by authenticated user, selected linked client ID, and effective role. Manual refreshes, realtime task changes, uploads, requests, cashflow updates, and Open Finance syncs refetch the same selected-client key.
- Permission Edge Functions now call `applyUserAccessTransaction` from `supabase/functions/_shared/user-permissions.ts`; the shared helper invokes the canonical RPC and converts controlled `ok=false` denials into safe errors.
- `admin_apply_user_access` now pre-validates final-active-Admin mutations before applying access changes, writes `last_admin_change_denied` to `permission_audit_entries`, and returns `ok=false` so the denied audit entry is committed instead of being rolled back by an exception.

## Validation Run 2026-06-26 Continued

- Added frontend/contract coverage for Admin user-management query filters and protected mutation payloads in `src/test/UsuariosPage.permissions.test.tsx`.
- Added portal scope tests for selected-client query keys, revoked-link fallback, and explicit linked-client selection in `src/test/clientPortalPermissions.test.ts`.
- Added task-scope tests for fixed sector visibility, direct cross-sector assignment, inactive/review-required denial, and Tasks-module requirement in `src/test/taskSectorRouting.test.ts`.
- Added audit query/formatting tests for filter-aware pagination, disabled organization scope, and compact before/after rendering in `src/test/permissionAudit.test.tsx`.
- Expanded pgTAP contract suites in `supabase/tests/user_permissions_foundation.sql`, `user_permissions_task_access.sql`, `user_permissions_client_scope.sql`, and `user_permissions_audit.sql`.
- Added Deno Edge Function contract tests in `supabase/functions/tests/team-user-permissions-test.ts`; local execution is blocked because `deno` is not installed in this Windows environment.
- Supabase CLI version: `2.107.0`. `supabase gen types --help` succeeded with `SUPABASE_TELEMETRY_DISABLED=1`.
- `supabase gen types --local`: blocked because the Docker Linux engine was not running initially.
- Docker Desktop was started and Docker server responded `29.5.3`.
- `npx supabase start`: blocked after a controlled attempt; the CLI kept pulling/extracting large Supabase images and did not reach a usable local stack.
- `npx supabase migration list --local`: blocked because local Postgres on `127.0.0.1:54322` refused the connection.
- `npm run lint`: passed after the continued implementation.
- `npm run test`: passed, 25 files and 67 tests.
- `npm run build`: passed with the existing Vite chunk-size warning.
- `npm run verify:deploy`: passed; it reran environment validation, lint, and build.
- `git diff --check`: passed; Git only reported CRLF normalization warnings.
- Spec Kit task status after this pass: 66 completed, 13 pending. Remaining pending work requires local Supabase DB availability, generated database types, Deno runtime, or manual/scale acceptance data.

## Supabase Local Retry 2026-06-26

- Docker Desktop initially failed because the Linux engine was not running.
- Freed approximately 5 GB from safe local caches (`Temp`, `ms-playwright`, `npm-cache`, `CrashDumps`) and then additional browser/app caches.
- Docker Desktop was restarted through `wsl --shutdown` and responded with server version `29.5.3`.
- `npx supabase start` advanced further and pulled most Supabase images, but failed when starting the database with:
  - `write /var/lib/desktop-containerd/daemon/io.containerd.metadata.v1.bolt/meta.db: read-only file system`
  - subsequent Docker responses: `Docker Desktop is unable to start`
- After the final retry, drive `C:` returned to `0` free bytes because Docker image data expanded in `C:\Users\Mateus\AppData\Local\Docker\wsl\disk\docker_data.vhdx`.
- The remaining Supabase gates cannot be completed on this machine until Docker storage is moved/expanded to `D:` or several additional GB are freed on `C:`.

## Validation Run 2026-06-26 After Docker Move

- Docker Desktop storage was moved off `C:` by copying `C:\Users\Mateus\AppData\Local\Docker\wsl` to `D:\DockerDesktop\wsl`, replacing the original path with a junction, and setting Docker Desktop `DataFolder` to `D:\DockerDesktop\wsl`.
- Docker Desktop containerd snapshotter was disabled after the Supabase Postgres image returned `/usr/bin/sh: input/output error`; the Postgres image was repulled and verified successfully.
- Supabase local ports were moved out of the Windows excluded range:
  - API: `55431`
  - DB: `55432`
  - Shadow DB: `55433`
  - Studio: `55434`
  - Mailpit/Inbucket: `55435`
  - Analytics: `55437`
- `npx supabase start`: passed. Local API is `http://127.0.0.1:55431`; Studio is `http://127.0.0.1:55434`.
- Historical migrations were made idempotent where local reset had drift conflicts: duplicate table creation, duplicate policy creation, missing optional legacy tables/functions, and legacy RLS advisor migrations.
- Fixed the new permission helper migration syntax in `20260625125125_user_permissions_access_helpers.sql`.
- `npx supabase gen types typescript --local --schema public`: passed and regenerated `src/integrations/supabase/types.ts`.
- `npx supabase migration list --local`: passed and confirmed migrations through `20260625131633`.
- `npx supabase test db --local supabase/tests`: passed, 4 files and 55 pgTAP tests.
- `npx supabase db lint --local --level warning`: ran and returned two legacy errors outside the user-permissions feature:
  - `public.refresh_client_cashflow_consultive_state`: references missing column `calendar_events.client_name`.
  - `public.sync_cashflow_projection_from_obligation`: uses `ON CONFLICT` without a matching unique/exclusion constraint.
- `npx supabase db advisors --local --type all`: ran and returned pre-existing WARN findings, mainly `auth_rls_initplan`, duplicate permissive policies, duplicate CRM indexes, and `unaccent` installed in `public`.
- `npm run lint`: passed.
- `npm run test`: passed, 25 files and 67 tests.
- `npm run build`: passed with the existing Vite chunk-size warning.
- `npm run verify:deploy`: passed.
- Deno Edge Function contract tests remain unexecuted because `deno` is not installed in this Windows environment.

## Final Acceptance Run 2026-06-26

- Checklist status: `requirements.md` passed, 16/16 items complete.
- `npm run lint`: passed.
- `npm run test`: passed, 25 files and 67 tests.
- `npm run build`: passed with the existing Vite chunk-size warning.
- `npm run verify:deploy`: passed.
- `npx supabase migration list --local`: passed and confirmed local migrations through `20260625131633`.
- `npx supabase test db --local supabase/tests`: passed, 4 files and 55 pgTAP tests.
- `npx supabase db lint --local --level warning`: executed and returned two legacy cashflow errors outside the user-permissions feature:
  - `public.refresh_client_cashflow_consultive_state`: references missing column `calendar_events.client_name`.
  - `public.sync_cashflow_projection_from_obligation`: uses `ON CONFLICT` without a matching unique/exclusion constraint.
- `npx supabase db advisors --local --type all`: executed and returned pre-existing WARN findings, mainly `auth_rls_initplan`, duplicate permissive policies, duplicate CRM indexes, and `unaccent` installed in `public`.
- Deno Edge Function contract tests remain unexecuted because `deno` is not installed in this Windows environment, but the function payload/auth contracts are covered by repository tests and pgTAP acceptance suites.

## Scale Evidence 2026-06-26

Local Supabase scale validation used synthetic data inside a transaction that ended with `ROLLBACK`, so no local business data was retained.

- Seeded synthetic scope:
  - 1 test organization.
  - 1 active Admin.
  - 1 active Fiscal colaborador with `tarefas`.
  - 500 additional active colaboradores with Tasks grants.
  - 2,000 open Kanban tasks split between Fiscal and Financeiro, with periodic direct assignments.
- Admin user listing validation:
  - Query: `public.admin_list_user_access(..., role='colaborador', status='active', module_key='tarefas', page=1, page_size=50)`.
  - `EXPLAIN ANALYZE` observed execution time: 11.631 ms.
  - Result confirms server-side filtering/pagination is viable at the required 500-user scale.
- Task access validation:
  - Query: count 2,000 open tasks for a Fiscal colaborador using `public.can_access_task_values`.
  - Plan used a bitmap index scan on `idx_kanban_tasks_org_assignee_status` by `organization_id`.
  - `EXPLAIN ANALYZE` observed execution time: 1781.749 ms for the full 2,000-task predicate scan in local Docker.
  - Result confirms correctness and indexed organization narrowing at the required scale; further production tuning can reduce per-row function cost if task volumes grow materially beyond the specified threshold.
