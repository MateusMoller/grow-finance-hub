# Edge Function Security Matrix

Source of function names and `verify_jwt`: `supabase/config.toml`.

| Control Area | Required baseline |
| --- | --- |
| JWT-protected functions | Validate JWT, actor status, role and organization before sensitive actions. |
| Public webhooks | Validate signature or provider equivalent, idempotency, payload schema and replay handling. |
| Service-role use | Only inside Edge Functions or trusted backend paths; never browser-visible. |
| Secrets | Read from environment, never logged, never returned in responses. |
| External integrations | Validate provider identity and store token metadata without exposing raw secrets. |
| AI actions | Require actor authorization, risk classification, confirmation for high-risk actions and audit logging. |

## High-Priority Modules

| Module | Functions | Status |
| --- | --- | --- |
| Identity and user management | `create-team-user`, `manage-team-user`, `create-admin`, `reset-client-portal-passwords` | Requires role, organization and payload validation evidence. |
| AI assistant | `grow-assistant`, `grow-assistant-confirm-action`, `_shared/ai/*` | Requires action confirmation and audit evidence. |
| WhatsApp/webhooks | `whatsapp-webhook`, `conecta-chat-webhook`, `email-inbox-webhook` | Critical until signature/idempotency validation is proven. |
| Open Finance | `open-finance-module`, `open-finance-webhook` | Critical until provider validation and secret handling are proven. |
| Acessorias | `acessorias-module` | Requires organization, role and service-role validation evidence. |
| Messaging | `send-site-contact-email`, `send-newsletter-broadcast`, `send-push-notification` | Requires rate-limit and payload validation expectations. |

Run `npm run security:inventory` for the generated per-function rows.

## Integra Contador (feature 013)

| Function | Entry authentication | Privileged boundary | Provider/network rule |
| --- | --- | --- | --- |
| `integra-contador-module` | Supabase JWT plus organization, membership, role and feature checks | Service role only after actor/tenant validation; manage/reprocess requires admin | Browser never receives SERPRO secrets or calls it directly |
| `integra-contador-worker` | Internal worker secret | Claims logged PGMQ jobs and revalidates tenant/client/capability | Real provider stays disabled until contract and mTLS evidence |
| `integra-contador-monitor` | Internal scheduler secret | Enqueues allowlisted monitoring work | Queue messages contain opaque IDs only |

Secrets are backend-only. Logs contain correlation IDs and redacted error codes, never taxpayer IDs, raw fiscal payload, token or certificate material.

## Integra Contador (feature 013)

| Function | Entry authentication | Privileged boundary | Provider/network rule |
| --- | --- | --- | --- |
| `integra-contador-module` | Supabase JWT plus organization, membership, role and feature-capability checks | Service role is used only after actor/tenant validation; management and reprocess actions require admin permission | Browser never receives SERPRO credentials or calls SERPRO directly |
| `integra-contador-worker` | Internal worker secret; no end-user route | Claims logged PGMQ jobs and revalidates organization/client/capability | Real provider remains disabled until the contract and mTLS gate is evidenced |
| `integra-contador-monitor` | Internal scheduler secret; no end-user route | Enqueues only allowlisted monitor/reconciliation work | Queue messages contain identifiers only, never CPF/CNPJ, tokens, certificates or raw fiscal payloads |

All three functions are declared with `verify_jwt = true` where invoked by users; internal invocations additionally require their dedicated secret. Secrets are backend-only (`SUPABASE_SERVICE_ROLE_KEY`, worker/cron invocation secrets and Vault references for SERPRO credentials/certificate). Ordinary logs use correlation IDs and redacted error codes only.

## Code Evidence

- `supabase/config.toml` marks `conecta-chat-webhook`, `email-inbox-webhook`, `whatsapp-webhook`, `open-finance-module` and `open-finance-webhook` with `verify_jwt = false`, so they remain critical until provider controls are proven.
- `supabase/functions/email-inbox-webhook/index.ts` reads `INBOX_WEBHOOK_SECRET` and rejects unauthorized webhook calls when the header secret is missing or invalid.
- `supabase/functions/open-finance-webhook/index.ts` records `open_finance_webhook_events` and parses provider-specific webhook events.
- `supabase/functions/whatsapp-webhook/index.ts` delegates verification to `_shared/ai/whatsapp.ts`.
- Multiple functions read `SUPABASE_SERVICE_ROLE_KEY`; each service-role path requires actor, organization and payload validation evidence before being treated as hardened.

## Live Supabase Evidence

- Supabase connector read the active project `vgkmcerjlwnzbiukinhd` on 2026-06-11.
- Deployed `manage-team-user` has `verify_jwt=false`, while local `supabase/config.toml` declares `verify_jwt=true`. This is critical until reconciled, even though the deployed function rejects requests without bearer token.
- Deployed `send-push-notification` has `verify_jwt=false`, while local `supabase/config.toml` declares `verify_jwt=true`.
- Deployed `send-site-contact-email` has `verify_jwt=false` and is not represented in local `supabase/config.toml`.
- Negative HTTP tests confirmed rejection for missing JWT on `manage-team-user` and invalid secrets on `email-inbox-webhook` and `open-finance-webhook`.
