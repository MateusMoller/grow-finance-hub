# Backup And Restore Runbook

## Production Requirements

- Automatic backups enabled.
- PITR enabled where the Supabase plan supports it.
- Restore test performed periodically into staging or a disposable project.
- Migration rollback plan for RLS, constraints and destructive schema changes.

## Restore Test Steps

1. Select restore point and target environment.
2. Restore to staging or isolated project.
3. Verify authentication, RLS-protected reads, Storage references and Edge Function dependencies.
4. Confirm no production secrets are copied into lower environments.
5. Record date, operator, restore duration, issues and next action.

## Evidence

Keep dashboard screenshots or export metadata outside the repo if they include sensitive project details. In this repo, record only summary status and link to the secure evidence location.
