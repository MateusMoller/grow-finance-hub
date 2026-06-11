# Quickstart: Parametros Gerais de Seguranca

Use this guide to validate the security baseline during planning and later
implementation.

The first increment is a Git-versioned baseline under `docs/security/`. It does
not require new database tables or an admin UI.

## 1. Confirm Active Feature

```bash
git branch --show-current
Get-Content .specify/feature.json
```

Expected:
- Branch is `001-security-parameters`
- Feature directory is `specs/001-security-parameters`

## 2. Review Baseline Inputs

Read:
- `specs/001-security-parameters/spec.md`
- `specs/001-security-parameters/plan.md`
- `specs/001-security-parameters/research.md`
- `.specify/memory/constitution.md`
- `docs/contexto-operacional-atual.md`
- `docs/tenant-ready-foundation.md`

## 3. Build The Security Control Matrix

Create inventory entries for:
- Public routes and public forms
- Internal `/app/*` routes
- Portal `/app/portal`
- Supabase tables in exposed schemas
- Storage buckets and file workflows
- Edge Functions in `supabase/config.toml`
- Public webhooks with `verify_jwt = false`
- AI, WhatsApp, Open Finance, Acessorias and e-mail integrations
- Auth/session/rate-limit/redirect URL settings
- Deploy headers, CSP and CORS
- Backup, restore and access review processes

Classify each item as public, internal, client portal or sensitive.

Critical classification rule:
- Treat possible cross-tenant/cross-client exposure as critical.
- Treat service-role or secret use without strong validation as critical.
- Treat improperly accessible private Storage as critical.

## 4. Validate High-Risk Rules First

Prioritize:
1. Portal cross-client access.
2. Internal role escalation.
3. Service-role Edge Functions.
4. Private document upload/download.
5. Public webhooks.
6. Open Finance, WhatsApp and AI actions.
7. Auth/session/MFA settings.
8. Production backups and access reviews.

Evidence requirement:
- Critical/high-risk items need evidence paths and validation status in the
  first baseline round.
- Medium-risk items need owner, review criteria and a due date within 60 days.
- Low-risk items need owner, review criteria and a due date within 90 days.

## 5. Required Manual Scenarios

Run these in staging before production rollout:

- Portal user attempts to access another client's data by changing an ID.
- Department-only user attempts admin/manager action.
- Internal user switches organization and attempts access outside active scope.
- Unauthorized user attempts private document download.
- Expired signed URL is reused.
- Upload attempts executable/script file.
- Public webhook receives duplicate event.
- Public webhook receives invalid signature or challenge.
- Privileged Edge Function receives missing/expired JWT.
- AI/WhatsApp medium-risk action requires confirmation.
- High-risk action requires human review.
- Error path does not expose secret, token or full sensitive payload.

## 6. Validation Commands

Run when implementation tasks touch code:

```bash
npm run lint
npm run test
npm run build
npm run verify:deploy
```

If commands fail because the local Node version is incompatible, report the
actual Node version and rerun in Node 22.12.0+ before production.

## 7. Rollout Checklist

- Confirm backup exists before RLS/constraint/storage policy changes.
- Apply migrations in staging first.
- Validate role, organization and client scenarios.
- Validate Storage private access and signed URL expiry.
- Validate Edge Function JWT/signature/idempotency handling.
- Confirm audit evidence for sensitive actions.
- Confirm deploy headers/CSP/CORS in target environment.
- Confirm Auth redirect URLs, session policy, rate limits and MFA.
- Document rollback SQL or restore path.
- Apply to production only after staging passes critical scenarios.

## 8. Baseline Completion Criteria

- `docs/security/security-control-matrix.md` exists and is reviewable in Git.
- 100% of critical/high-risk items have evidence paths and validation status.
- 100% of medium-risk items have owner, review criteria and due date within 60
  days.
- 100% of low-risk items have owner, review criteria and due date within 90
  days.
- Runtime hardening is represented as prioritized follow-up work unless a
  critical item has been approved for immediate remediation.
