# Audit Event Catalog

Required audit events:

| Event | Required fields | Current status |
| --- | --- | --- |
| Login/logout/failure | actor, timestamp, result, IP/user-agent where available | Requires Auth/dashboard evidence. |
| Password or email change | actor, target user, timestamp, result | Requires Auth flow evidence. |
| User creation | actor, target user, organization/client, role, result | Partial code review required in user functions. |
| Permission change | actor, target user, old role, new role, result | Partial code review required in `manage-team-user`. |
| Document upload/download/delete | actor, organization/client, object path/id, action, result | Gap until Storage flows prove audit coverage. |
| Report generation/export | actor, organization/client, report type, result | Requires report flow review. |
| Integration token change | actor, provider, organization, action, result | Requires token-management review. |
| Public webhook event | provider, external event id, processed status, result | Requires webhook review and idempotency evidence. |
| AI sensitive action | actor, intent, risk, confirmation, result | Requires `_shared/ai` review. |
| Service-role action | function, actor, organization/client, entity, result | Requires Edge Function review. |

Audit logs must not contain secrets, raw tokens or real sensitive document contents.

## Code Evidence

- `supabase/functions/create-client-with-portal/index.ts` inserts `operational_audit_logs` for client/portal creation actions.
- `supabase/functions/manage-team-user/index.ts` inserts `operational_audit_logs` for user-management changes.
- `src/pages/PortalClientePage.tsx` records `portal_document_uploaded` when portal users upload documents.
- `supabase/functions/open-finance-webhook/index.ts` stores webhook processing status in `open_finance_webhook_events`.
- Document download audit coverage remains a gap until staging proves a download event is recorded with actor, client/organization, object and result.
