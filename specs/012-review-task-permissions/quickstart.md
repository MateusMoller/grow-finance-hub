# Quickstart: Implementação das permissões de tarefas

## 1. Establish baseline

```powershell
git status --short
npm run security:inventory
npx supabase db lint --linked
```

Capture current policies, grants, function ACLs and users relying only on legacy roles before any mutation.

## 2. Create migration correctly

```powershell
npx supabase migration new harden_task_permissions
```

The migration must:

1. Drop the legacy manager DELETE policy.
2. Revoke global privileges not protected by RLS.
3. Revoke anon/PUBLIC execution of task security-definer helpers.
4. Add private capability helpers and canonical policies.
5. Add/adjust mutation and audit functions.
6. Include comments describing rollout and rollback boundaries.

## 3. Add database tests before rollout

Create pgTAP tests under `supabase/tests/` for:

- exact policy set and commands;
- exact grants for anon/authenticated;
- admin, same-sector collaborator, other-sector collaborator, client and suspended user;
- cross-organization task ids;
- sensitive field updates;
- comments and relations;
- legacy-only users before and after enforcement.

Run locally:

```powershell
npx supabase start
npx supabase test db
```

## 4. Implement canonical mutation path

- Add authenticated `task-actions` Edge Function.
- Add shared server-only task authorization helper.
- Route Kanban/List/Calendar/detail mutations through the function.
- Keep reads behind RLS and server-side filters.
- Make audit success transactional with mutation.

## 5. Migrate privileged integrations

Search all direct mutations:

```powershell
rg -n 'from\("kanban_tasks"\).*|\.from\("kanban_tasks"\)' supabase/functions src
```

For each write, classify as delegated human or trusted system actor and use the appropriate canonical contract.

## 6. Roll out legacy removal

1. Produce legacy dependency report.
2. Backfill canonical access.
3. Enable shadow decision comparison.
4. Review divergences.
5. Enable canonical enforcement.
6. Remove fallback code after the observation window.

## 7. Validate

```powershell
npm run lint
npm run test
npm run build
npm run verify:deploy
npx supabase test db
```

Also run Supabase security/performance advisors and manually verify Kanban, Lista, Calendário, detail deep-link, WhatsApp ticket completion and obligation synchronization.

## 8. Rollback rule

Rollback may disable the new mutation route or restore the last canonical policies. It must never restore anonymous function execution, global TRUNCATE grants or the legacy manager DELETE policy.
