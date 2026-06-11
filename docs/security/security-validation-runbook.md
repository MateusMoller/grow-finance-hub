# Security Validation Runbook

## Command Results

| Date | Command | Result | Evidence |
| --- | --- | --- | --- |
| 2026-06-10 | `npm run security:inventory` | Passed | Generated `docs/security/security-control-matrix.md` with 37 routes, 20 Edge Functions, 23 Storage usages and 436 Supabase access calls. |
| 2026-06-10 | `node scripts/security/inventory-routes.mjs` | Passed | Script executed successfully. |
| 2026-06-10 | `node scripts/security/inventory-edge-functions.mjs` | Passed | Script executed successfully. |
| 2026-06-10 | `node scripts/security/inventory-storage-usage.mjs` | Passed | Script executed successfully. |
| 2026-06-10 | `node scripts/security/inventory-supabase-access.mjs` | Passed | Script executed successfully. |
| 2026-06-10 | `npm run lint` | Passed | ESLint completed with exit code 0. |
| 2026-06-10 | `npm run test` | Blocked | Local Node is `v18.20.8`; Vitest/Rolldown requires a newer Node runtime and failed before tests executed because `node:util` has no `styleText` export. Project `package.json` requires Node `>=22.12.0`. |
| 2026-06-10 | `npm run build` | Blocked | Local Node is `v18.20.8`; Vite requires Node `20.19+` or `22.12+` and failed before build with `CustomEvent is not defined`. Project `package.json` requires Node `>=22.12.0`. |
| 2026-06-11 | Supabase connector: list projects, tables, migrations and Edge Functions | Passed read-only | `docs/security/supabase-live-read-validation.md` records live project inventory. |
| 2026-06-11 | Negative HTTP tests for `manage-team-user`, `email-inbox-webhook`, `open-finance-webhook` | Passed safe-rejection paths | Missing JWT and invalid webhook secrets were rejected without using sensitive credentials. |
| 2026-06-11 | `npm run security:inventory` | Passed | Regenerated `docs/security/security-control-matrix.md` with live deployment reconciliation findings preserved in generated priority rows. |
| 2026-06-11 | `npm run lint` | Passed | ESLint completed with exit code 0 after live evidence updates. |

## Manual Scenarios

| Scenario | File | Environment | Status |
| --- | --- | --- | --- |
| Access control | `docs/security/manual-scenarios/access-control.md` | staging | Blocked pending staging credentials and test users. |
| Storage documents | `docs/security/manual-scenarios/storage-documents.md` | staging | Blocked pending staging bucket and test files. |
| Edge Functions and webhooks | `docs/security/manual-scenarios/edge-functions-webhooks.md` | connected Supabase project | Partially passed safe-rejection tests; duplicate webhook/idempotency and valid provider fixture tests remain blocked. |
| Audit and incident response | `docs/security/manual-scenarios/audit-incident-response.md` | staging | Blocked pending representative test actions. |
| Operational controls | `docs/security/manual-scenarios/operational-controls.md` | staging/production | Blocked pending dashboard access. |

## Blocked Validations

- Cross-client portal access cannot be proven locally without at least two staging clients and two portal users.
- Private Storage access cannot be proven locally without staging bucket policies and representative files.
- Public webhook signature/idempotency cannot be proven locally without provider fixtures or staging secrets.
- Auth session, MFA, redirect URL and rate-limit settings require Supabase dashboard access.
- Backup, PITR and restore status require Supabase project access.
- `npm run test` and `npm run build` require rerun under Node `>=22.12.0`.
- Cross-client, Storage and audit scenarios still require staging test users/files or safe fixture data.
- The Supabase branch lookup failed through the connector, so no staging branch was confirmed.

## Residual Risks

- Inventory scripts identify code references, not effective RLS policy behavior.
- UI route protection must be backed by RLS or Edge Function authorization.
- Dynamic Storage bucket names are flagged for manual resolution.
- Public functions with `verify_jwt = false` are critical until provider controls are validated.
- Code inventory cannot prove public webhook signature validation, Storage bucket privacy or effective RLS behavior without staging tests.
- Deployed Edge Function settings diverge from local `supabase/config.toml` for `manage-team-user`, `send-push-notification` and `send-site-contact-email`; reconcile before treating the deployment as hardened.

## Contract Deviations

No deliberate deviation from `specs/001-security-parameters/contracts/security-baseline-contract.md` is known. Runtime enforcement remains follow-up work generated from the matrix.
