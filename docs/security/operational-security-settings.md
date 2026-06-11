# Operational Security Settings

| Control | development | staging | production |
| --- | --- | --- | --- |
| Database separation | Local or disposable project. | Dedicated staging project. | Dedicated production project only. |
| Keys | Development-only anon/service keys. | Staging-only keys. | Production keys stored only in deploy/Supabase secrets. |
| Production data | Never required. | Masked or synthetic data only. | Real client data only. |
| Migrations | Versioned in repository. | Applied before production. | Applied after review and rollback plan. |
| Backups | Optional local dumps. | Restore rehearsal target. | Automatic backups and PITR where plan supports it. |
| Secrets | `.env.local`, never committed. | Platform secrets. | Platform secrets with rotation process. |
| Access review | Developer self-review. | Monthly technical review. | Monthly owner/admin review. |

## Secret Handling

- `SUPABASE_SERVICE_ROLE_KEY` must never be exposed in browser code.
- `NEXT_PUBLIC_` or `VITE_` variables must contain only public client configuration.
- Secrets must not be sent by chat, email, screenshots or logs.
- Any leaked key must be revoked and rotated immediately.

## Required Follow-Up Evidence

- Confirm production backup schedule.
- Confirm PITR availability or compensating restore process.
- Confirm staging restore rehearsal date.
- Confirm production Supabase dashboard MFA for project members.

## Code And Documentation Evidence

- `.env.example` exposes only public frontend keys under `VITE_` and documents backend/Supabase Edge Function secrets separately.
- `README.md` instructs copying `.env.example` to `.env` and configuring real Supabase values locally.
- `docs/contexto-operacional-atual.md` confirms Supabase Auth, Database, Storage, Realtime and Edge Functions as the operational backend.
- Sensitive integrations are expected to run through `supabase.functions.invoke` or Edge Function secrets, not browser-exposed service-role keys.
- Supabase connector confirmed the active project `vgkmcerjlwnzbiukinhd` is `ACTIVE_HEALTHY`; no staging branch could be confirmed because branch lookup failed in the connector.
