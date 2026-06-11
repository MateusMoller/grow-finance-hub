# Supabase Live Read Validation

Date: 2026-06-11

Project read by Supabase connector:

- Project ref: `vgkmcerjlwnzbiukinhd`
- Name: `MateusMoller's Project`
- Status: `ACTIVE_HEALTHY`
- Region: `us-east-2`
- Database engine: Postgres 17

## Read-Only Findings

| Area | Evidence | Status |
| --- | --- | --- |
| Public/storage tables | Supabase connector listed `public` and `storage` tables with `rls_enabled=true`. | Passed for RLS-enabled inventory only. |
| Storage system tables | `storage.buckets` and `storage.objects` have RLS enabled. | Passed for RLS-enabled inventory only. |
| Migrations | Remote migration list includes hardening migrations through `20260601132220_restrict_kanban_tasks_by_role_sector`. | Passed for migration inventory only. |
| Edge Functions | Supabase connector listed 15 active functions. | Review required because deployed `verify_jwt` differs from local `supabase/config.toml` for some functions. |

## Deployed Edge Function Divergences

| Function | Local `supabase/config.toml` | Deployed Supabase setting | Risk |
| --- | --- | --- | --- |
| `manage-team-user` | `verify_jwt=true` | `verify_jwt=false` | Critical until deployment config is reconciled, even though function code checks bearer token internally. |
| `send-push-notification` | `verify_jwt=true` | `verify_jwt=false` | High/critical until authorization behavior is reviewed. |
| `send-site-contact-email` | Not present in local config inventory | `verify_jwt=false` | Public contact function; requires rate-limit/spam controls. |

## Negative HTTP Tests

Executed from local machine without secrets and without valid user credentials:

| Scenario | Result |
| --- | --- |
| `manage-team-user` without JWT | HTTP 401, body `{"error":"Authorization token is required"}`. |
| `email-inbox-webhook` with invalid secret | HTTP 401, body `{"error":"Unauthorized webhook call"}`. |
| `open-finance-webhook` with invalid Pluggy secret | HTTP 400, body `{"error":"Unauthorized Pluggy webhook"}`. |

These tests validate safe rejection paths only. They do not prove cross-client access, Storage object authorization, audit coverage, backup settings, MFA, redirect URLs or successful webhook idempotency.
