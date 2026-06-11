# Implementation Plan: Parametros Gerais de Seguranca

**Branch**: `001-security-parameters` | **Date**: 2026-06-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-security-parameters/spec.md`

## Summary

Establish a project-wide auditable security baseline for Grow Finance Hub across
Supabase Database/RLS, Auth, Storage, Edge Functions, frontend deployment
controls, auditability, backups, and operational access reviews. The first
increment creates versioned documentation, inventory, control matrices,
validation runbooks and gap identification under `docs/security/`. Runtime
hardening is planned from prioritized gaps, except critical risks approved for
immediate remediation.

## Technical Context

**Language/Version**: TypeScript with React 18 and Vite for frontend; Supabase
Edge Functions in TypeScript/Deno; PostgreSQL SQL migrations. Node runtime for
local validation must be Node 22.12.0+ per `package.json`.

**Primary Dependencies**: Supabase Auth, Database, Storage and Edge Functions;
React Router, TanStack Query, shadcn/Radix, lucide-react, Zod where schema
validation is needed in frontend/Edge Functions, existing local helpers in
`src/lib` and `supabase/functions/_shared`.

**Storage**: Supabase Postgres for operational data, RLS policies and audit
records; Supabase Storage for private documents and public assets; first
baseline artifacts stored as Markdown under `docs/security/`.

**Testing**: `npm run lint`, `npm run test`, `npm run build`,
`npm run verify:deploy`; Supabase migration review for later remediation;
staged manual validation for role, tenant, client, document, webhook,
Auth/session, and privileged Edge Function scenarios.

**Target Platform**: Browser web application with public site, internal app and
client portal; Supabase hosted backend; deployment targets documented in the
repo include Vercel, Netlify and GitHub Pages for the frontend.

**Project Type**: Web application with Supabase backend, Edge Functions,
Storage, migrations and operational integrations.

**Performance Goals**: Baseline generation must be lightweight enough to run in
normal development without blocking code review. Later security checks must not
make primary workflows noticeably slower. High-volume screens must remain
bounded through pagination, server filtering, cached query state, indexed
lookups, or background work. Audit/webhook logging must be append-friendly and
indexed for investigation.

**Constraints**: No secrets in frontend bundles or public assets; no UI-only
authorization for sensitive actions; RLS required for exposed operational
tables; service-role actions only in trusted backend code after JWT, role,
organization, client and payload validation; rollout must avoid breaking current
Grow single-tenant flows while preserving tenant-ready evolution. First
baseline must not require new database tables or an admin UI.

**Scale/Scope**: Covers current public site, internal app, portal, Supabase
Database, Storage, Edge Functions, webhooks, AI, WhatsApp, Open Finance,
Acessorias, newsletter, push notifications, documents, obligations, financial
data, CRM, tasks, calendar and user management. Critical and high-risk items
require evidence in the first round; medium-risk items require review due dates
within 60 days; low-risk items require review due dates within 90 days.

**Affected Surfaces**: Public site, internal app, client portal, Supabase
database, RLS, Storage buckets, Edge Functions, Auth settings, frontend deploy
headers, CORS, webhooks, AI/WhatsApp/Open Finance/Acessorias integrations,
audit logs, backups, access review processes.

**Security/Tenant Scope**: Roles `admin`, `director`, `manager`, `employee`,
`commercial`, `partner`, `departamento_pessoal`, `fiscal`, `contabil`,
`client`; organization scope through `organization_id`, `user_roles`,
`organization_settings`; client scope through `client_users` with documented
legacy fallback to `clients.portal_user_id` only where still required.

**Business Rule Owner**: Baseline source of truth is Git-versioned documentation
under `docs/security/`. Authorization and data integrity runtime rules remain
owned by Supabase RLS, migrations, SQL helper functions and Edge Functions.
React UI owns navigation affordances, form ergonomics and cache orchestration
only. Deployment headers and operational settings are owned by
deployment/Supabase project configuration.

**Observability/Rollback**: The first increment records evidence in
`docs/security/` and maps existing runtime evidence from `operational_audit_logs`
and module-specific logs (`ai_*`, `whatsapp_webhook_logs`,
`open_finance_webhook_events`, integration logs). RLS/constraint/storage changes
are follow-up remediation items unless critical risk is approved for immediate
fix; those changes require staging rollout, backup confirmation, rollback SQL or
restore path, and manual validation scenarios.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Security and Least Privilege

- [x] Public, internal, and client-portal surfaces remain separated by route,
      role, and backend authorization.
- [x] No secrets, service-role keys, OpenAI/WhatsApp/Open Finance/Acessorias
      credentials, or integration tokens are exposed to client code or logs.
- [x] Privileged operations validate JWT, organization, role, client access,
      action intent, and input shape before using service-role access.

### Tenant Isolation and Data Segregation

- [x] New or changed operational data is organization-aware.
- [x] Client portal flows enforce client-level access through `client_users`
      or a documented legacy fallback.
- [x] RLS, storage policies, and signed URL scope are addressed for affected
      tables/files.

### Backend-Owned Business Rules

- [x] Authorization, synchronization, deduplication, automation, completion,
      document classification, financial state, obligation state, and external
      integration rules live in the responsible backend layer.
- [x] Any frontend-only rule is non-sensitive, justified, and backed by backend
      validation where data integrity or access control matters.

### Scalable Frontend and Data Access

- [x] Shared/repeated remote state uses TanStack Query or a justified existing
      pattern.
- [x] Independent requests start early and use `Promise.all` where safe.
- [x] High-volume lists, filters, tables, and derived state use pagination,
      server filtering, indexing, `Map`/`Set`, virtualization, or another
      concrete scaling strategy.
- [x] Public routes avoid importing internal-only workflows or heavy
      dependencies.

### Auditability, Reliability, and Operability

- [x] Operational state changes have audit/logging coverage sufficient to
      identify actor, organization, client, action, and integration/automation.
- [x] Integration and webhook failures fail closed for sensitive actions and
      return controlled UI errors.
- [x] Validation commands are identified: `npm run lint`, `npm run test`,
      `npm run build`, or `npm run verify:deploy`.
- [x] Migrations that alter RLS, constraints, tenant scope, or critical tables
      include rollout and rollback considerations.

## Project Structure

### Documentation (this feature)

```text
specs/001-security-parameters/
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   `-- security-baseline-contract.md
|-- checklists/
|   `-- requirements.md
`-- spec.md
```

### Source Code (repository root)

```text
docs/
`-- security/

scripts/
`-- security/

src/
|-- App.tsx
|-- components/
|-- hooks/
|-- integrations/supabase/
|-- lib/
|-- pages/
`-- test/

supabase/
|-- config.toml
|-- functions/
|-- migrations/
```

**Structure Decision**: Use the existing single Vite/React project with
Supabase as backend. First implementation creates `docs/security/` and
`scripts/security/` artifacts for inventory and evidence. Runtime hardening
will be generated from matrix gaps and implemented later in `supabase/migrations`,
`supabase/functions`, deploy config, or `src` depending on owner layer.

## Complexity Tracking

No constitution violations are planned.

## Phase 0: Research Summary

See [research.md](research.md). Key decisions:

- Use RLS and explicit grants as the primary database authorization boundary.
- Keep service-role and integration credentials inside Edge Functions only.
- Treat private documents as private Storage objects with scoped signed access.
- Keep portal client authorization centered on `client_users`.
- Add a Git-versioned security control matrix under `docs/security/` before
  broad changes so follow-up hardening tasks can be generated by module and
  risk.
- Classify critical risk as possible cross-tenant/cross-client exposure,
  service-role/secret use without strong validation, or improperly accessible
  private Storage.

## Phase 1: Design Summary

See [data-model.md](data-model.md), [quickstart.md](quickstart.md), and
[contracts/security-baseline-contract.md](contracts/security-baseline-contract.md).

Design outputs define the security entities, validation rules, `docs/security/`
artifact shape, rollout workflow, and expected evidence for `/speckit-tasks`.

## Post-Design Constitution Check

All gates remain passing. The design keeps sensitive enforcement mapped to
Supabase RLS, Storage policies, SQL helpers and Edge Functions; uses existing
project roles and organization/client boundaries; and requires staged
validation before production. The first increment is an auditable repository
baseline rather than broad runtime hardening.
