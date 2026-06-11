# Research: Parametros Gerais de Seguranca

## Decision: RLS and explicit grants are the primary database boundary

Rationale: Supabase documents Data API access as a combination of grants and
RLS policies: grants decide whether a role can touch an object, while RLS
decides which rows can be read or modified. The Grow Finance Hub already has a
tenant-ready foundation with `organization_id`, `user_roles`, `client_users`,
`has_org_role`, `is_internal_user` and `can_access_client`, so the safest path
is to inventory all exposed operational tables and ensure each has explicit
SELECT/INSERT/UPDATE/DELETE behavior.

Sources:
- https://supabase.com/docs/guides/api/securing-your-api
- https://supabase.com/docs/guides/database/postgres/row-level-security

Alternatives considered:
- Frontend-only role checks: rejected because route/UI checks do not protect
  the Data API, direct requests, or manipulated IDs.
- One generic `using (true)` policy: rejected for sensitive data because it
  creates broad exposure and defeats tenant isolation.

## Decision: Privileged operations stay in Edge Functions

Rationale: The existing architecture already routes sensitive work through
Edge Functions such as `create-team-user`, `manage-team-user`,
`manage-integration-token`, `grow-obligations-module`, `grow-assistant`,
`open-finance-module` and webhook handlers. The baseline should formalize that
functions using service-role access must authenticate the JWT where applicable,
resolve organization/client scope, validate role/action intent, validate input
shape, and log controlled failures without leaking secrets.

Sources:
- https://supabase.com/docs/guides/functions
- https://supabase.com/docs/guides/api/securing-your-api

Alternatives considered:
- Moving sensitive calls to the frontend with publishable keys: rejected
  because secrets and privileged operations would become browser-visible or
  rely on UI checks.
- Creating a separate backend service now: rejected because Edge Functions are
  already the local project pattern and cover the needed trust boundary.

## Decision: Private documents use private Storage plus scoped access evidence

Rationale: Supabase Storage uses Postgres RLS on `storage.objects`, and private
buckets require explicit policies or signed access. The project contains
document-heavy flows in portal, obligations, client files, process documents
and newsletter media. The baseline must distinguish public assets from private
client/payroll/tax/financial documents and require upload/download evidence in
audit logs for sensitive buckets.

Sources:
- https://supabase.com/docs/guides/storage/security/access-control

Alternatives considered:
- Public buckets for client documents: rejected because URLs can be shared and
  cannot enforce per-client access at request time.
- Trusting original file names: rejected because names can contain misleading,
  sensitive, or unsafe content.

## Decision: `client_users` is the default portal authorization model

Rationale: Existing tenant-ready documentation says `client_users` was added
to allow more than one portal user per client and that portal, AI and Open
Finance already accept it with fallback to `portal_user_id`. The security
baseline should use `client_users` as the required model and document fallback
only as a temporary compatibility path.

Alternatives considered:
- Continue relying primarily on `clients.portal_user_id`: rejected because it
  limits multi-user/multi-client portal scenarios and weakens tenant-ready
  scalability.

## Decision: Auth hardening is operational configuration plus validation

Rationale: MFA, session lifetime, inactivity timeout, single-session behavior,
Auth rate limits and redirect URLs are primarily Supabase project settings.
The implementation should document environment-specific target settings and
validate them in staging/production checklists. Supabase documents configurable
session limits, rate limits and redirect URL controls.

Sources:
- https://supabase.com/docs/guides/auth/sessions
- https://supabase.com/docs/guides/auth/rate-limits
- https://supabase.com/docs/guides/auth/redirect-urls

Alternatives considered:
- Build custom session management first: rejected unless Supabase plan limits
  or requirements prove built-in controls insufficient.

## Decision: Security headers/CSP/CORS are deploy-target controls

Rationale: The frontend can be deployed to Vercel, Netlify or GitHub Pages.
Headers and CSP must be defined for the deployed target and validated per
environment. CORS for Edge Functions/webhooks must be restricted for
authenticated routes while preserving valid external webhook flows.

Alternatives considered:
- Keep wildcard CORS for all functions: rejected for authenticated or
  browser-called sensitive routes. Public webhook endpoints may need different
  origin/signature handling and must be documented separately.

## Decision: Audit is append-first with module-specific evidence

Rationale: The project already has `operational_audit_logs` and module logs
for AI, WhatsApp and Open Finance. The baseline should define which sensitive
actions must write audit evidence and which existing log table is authoritative
for each module. This avoids duplicating every log while ensuring incident
investigation can identify actor, organization, client, action, entity,
timestamp and integration source.

Alternatives considered:
- One universal audit table for every event immediately: deferred because
  existing module logs already hold useful evidence. A universal view or
  health panel can be planned after inventory.

## Decision: Implementation starts with a security control matrix

Rationale: The feature spans many modules and surfaces. A matrix prevents a
large, fragile rewrite by listing every protected table, bucket, route,
function and integration with current state, required control, owner, evidence,
priority and rollout status. `/speckit-tasks` can then generate focused tasks
by risk.

Alternatives considered:
- Directly patch all migrations/functions without inventory: rejected because
  the blast radius is high and missing one module would create false confidence.

## Decision: The first baseline source of truth is `docs/security/`

Rationale: The clarified scope is an auditable baseline, not immediate runtime
hardening. Versioned Markdown artifacts in `docs/security/` provide reviewable
evidence in pull requests, work without a new admin UI or database schema, and
can be promoted into database-backed tracking later if operational review needs
it.

Alternatives considered:
- Database tables as the first source of truth: deferred because this would add
  schema, RLS and UI/operational work before the control model is proven.
- Hybrid Git plus database from day one: deferred because it increases scope and
  slows the first inventory pass.

## Decision: Evidence is mandatory first for critical and high risk

Rationale: Requiring full evidence for all surfaces would slow the initial
baseline and obscure the highest-risk work. Critical and high-risk items must
have evidence paths and validation status in the first round. Medium-risk items
must have owner, review criteria and due date within 60 days; low-risk items
must have owner, review criteria and due date within 90 days.

Alternatives considered:
- Evidence for all items immediately: rejected as too broad for a first
  baseline.
- Evidence only for critical items: rejected because high-risk items still carry
  meaningful client, financial or operational exposure.

## Decision: Critical risk has explicit security triggers

Rationale: The baseline must avoid subjective downgrading of the most dangerous
classes of issue. Any possible cross-tenant or cross-client exposure,
service-role or secret usage without strong validation, or improperly accessible
private Storage is critical until evidence proves otherwise.

Alternatives considered:
- Critical only after confirmed data leakage: rejected because waiting for
  confirmed leakage is too late for an accounting platform.
- Critical for any missing control: rejected because it would make the risk
  model too noisy for prioritization.
