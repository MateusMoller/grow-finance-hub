# Security Inventory Scripts

These scripts support the first security baseline under `docs/security/`.

## Commands

- `node scripts/security/inventory-routes.mjs`: lists public, internal and portal routes from `src/App.tsx`.
- `node scripts/security/inventory-edge-functions.mjs`: lists Supabase Edge Functions and `verify_jwt` from `supabase/config.toml`.
- `node scripts/security/inventory-storage-usage.mjs`: lists `storage.from(...)` calls under `src/` and `supabase/functions/`.
- `node scripts/security/inventory-supabase-access.mjs`: lists Supabase `.from(...)` table calls under `src/` and `supabase/functions/`.
- `npm run security:inventory`: merges all inventories into `docs/security/security-control-matrix.md`.

## Evidence Workflow

1. Run `npm run security:inventory` before any security review.
2. Review critical and high rows first.
3. Add staging/manual validation links to the matrix or `docs/security/security-validation-runbook.md`.
4. Open separate hardening tasks for any row with `blocked_pending_staging`, `requires_*_validation` or critical findings.

The scripts are intentionally dependency-free and conservative. Dynamic bucket names and runtime-only authorization paths are flagged for manual resolution instead of being assumed safe.
