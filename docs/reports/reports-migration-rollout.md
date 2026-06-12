# Reports Migration Rollout

Migration: `supabase/migrations/20260612090000_harden_saved_reports_for_reports_module.sql`

## Rollout

1. Apply migration in staging.
2. Verify `saved_reports.organization_id` is populated for all existing rows.
3. Verify `saved_reports.normalized_name` is populated for existing names.
4. Validate owner-only access still works for authenticated internal users.
5. Validate users do not see saved models from another organization.

## Rollback

If access issues appear after rollout:
1. Disable the reports module by organization feature flag.
2. Restore previous RLS policies for `saved_reports`.
3. Keep `organization_id` and `normalized_name` columns in place unless a full database restore is required.
4. Re-enable the module only after owner and organization access are confirmed.

## Data safety

The migration must not delete saved report records. Invalid or stale columns are handled by catalog diagnostics in the application layer.
