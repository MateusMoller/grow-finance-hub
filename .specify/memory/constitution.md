<!--
Sync Impact Report
Version change: template -> 1.0.0
Modified principles:
- PRINCIPLE_1_NAME -> I. Security and Least Privilege
- PRINCIPLE_2_NAME -> II. Tenant Isolation and Data Segregation
- PRINCIPLE_3_NAME -> III. Backend-Owned Business Rules
- PRINCIPLE_4_NAME -> IV. Scalable Frontend and Data Access
- PRINCIPLE_5_NAME -> V. Auditability, Reliability, and Operability
Added sections:
- Mandatory Security Controls
- Delivery Workflow and Quality Gates
Removed sections:
- Placeholder Section 2
- Placeholder Section 3
Templates requiring updates:
- .specify/templates/plan-template.md: updated
- .specify/templates/spec-template.md: updated
- .specify/templates/tasks-template.md: updated
- .specify/templates/commands/*.md: not present
Follow-up TODOs:
- None
-->

# Grow Finance Hub Constitution

## Core Principles

### I. Security and Least Privilege

All features MUST preserve least-privilege access across Supabase Auth, database
RLS, Edge Functions, Storage buckets, and UI navigation. Public, internal, and
client-portal surfaces MUST remain separated by route scope, role checks, and
data access rules. Secrets, service-role keys, OpenAI keys, WhatsApp tokens,
Acessorias credentials, Open Finance credentials, and integration tokens MUST
never be exposed to Vite client code, browser storage, logs, screenshots, or
public assets.

Rationale: the product handles accounting, financial, fiscal, labor, and client
identity data. A UI-only permission check is not sufficient protection.

### II. Tenant Isolation and Data Segregation

Every new persistent feature MUST be organization-aware when it touches
operational data. Tables, queries, mutations, storage paths, audit logs, and
Edge Functions MUST resolve and enforce the active organization before reading
or writing tenant-scoped records. Client portal flows MUST enforce client-level
authorization through `client_users`, with compatibility fallbacks used only
where legacy data still requires them.

Features MUST NOT mix data between the public site, internal app, and client
portal. Cross-client, cross-organization, and internal-to-portal data movement
requires explicit authorization, auditable intent, and tests or documented
manual validation.

Rationale: the current Grow organization is the default tenant, but the system
is evolving toward multi-organization operation and must not accumulate
single-tenant assumptions.

### III. Backend-Owned Business Rules

Business-critical rules MUST live in the responsible backend layer whenever
they affect authorization, synchronization, deduplication, automation,
completion, external integrations, financial data, obligation status, document
classification, or irreversible state changes. Frontend code MAY orchestrate
forms, cache, optimistic UI, and user feedback, but it MUST NOT be the sole
source of truth for sensitive decisions.

Edge Functions using service-role privileges MUST validate the user JWT,
organization, role, client access, action intent, and input shape before using
privileged database operations. Sensitive AI or WhatsApp actions MUST include
risk classification, confirmation or human review when required, and backend
revalidation of the target client.

Rationale: backend ownership keeps rules consistent across the internal app,
portal, automations, webhooks, and future clients.

### IV. Scalable Frontend and Data Access

React and TypeScript work under `src/` MUST keep render cost, network cost, and
bundle cost proportional to the active route and user workflow. Data fetching
for repeated or shared remote state SHOULD use TanStack Query for caching,
deduplication, loading states, error states, and invalidation. Independent
requests SHOULD start early and use `Promise.all` when there is no dependency.

High-volume screens such as Clientes, Obrigacoes, Calendario, Tarefas/Kanban,
Relatorios, Financeiro, CRM, and portal dashboards MUST avoid repeated linear
scans in render paths where indexed `Map` or `Set` structures are appropriate.
Large lists SHOULD use pagination, virtualization, server-side filtering, or
section-level loading. Public routes MUST NOT import internal-only workflows or
heavy dependencies unless the route needs them.

Rationale: accounting operations grow by client count, obligation volume,
documents, messages, and monthly history. Performance is a product requirement,
not a later cleanup task.

### V. Auditability, Reliability, and Operability

Features that change operational state MUST leave enough trace to investigate
who acted, what changed, which client and organization were affected, and which
automation or integration participated. Failures in integrations, webhooks,
email, WhatsApp, Open Finance, Acessorias, AI, document ingestion, and push
notifications MUST fail closed for sensitive actions and return controlled
errors to the UI.

Deployable changes MUST be validated with the available quality gates:
`npm run lint`, `npm run test`, `npm run build`, or `npm run verify:deploy`.
If the local environment prevents a gate from running, the limitation and its
impact MUST be reported. Database migrations MUST include rollout and rollback
considerations when they alter RLS, constraints, tenant scope, or critical
operational tables.

Rationale: the system is an operational hub. Debuggability, rollback safety,
and controlled failure are required to maintain trust.

## Mandatory Security Controls

- Public site routes MUST remain unauthenticated and free of internal-only data
  dependencies.
- Internal app routes MUST use `ProtectedRoute` with internal scope and backend
  authorization for privileged operations.
- Client portal routes MUST use portal scope and MUST only expose data for
  clients authorized to the current user.
- New Supabase tables that store operational or client data MUST enable and
  validate RLS before production use.
- New Edge Functions that use service-role access MUST authenticate the caller,
  authorize the requested organization/client/action, validate input, and avoid
  logging secrets or sensitive document contents.
- File uploads MUST validate type, size, storage bucket, and path ownership.
  Signed URLs MUST be short-lived and scoped to the intended file.
- AI-generated actions MUST be treated as proposals unless classified as safe
  low-risk queries. Medium-risk actions require explicit confirmation; high-risk
  actions require human review or an approved secure delivery flow.
- Legacy modules such as standalone Acessorias/e-continuo and old
  Processos/Documentos flows MUST NOT be reactivated as primary flows without
  an explicit architecture decision.

## Delivery Workflow and Quality Gates

Every feature specification MUST state affected surfaces: public site, internal
app, client portal, Supabase database, Edge Functions, Storage, automations,
webhooks, or external integrations. The implementation plan MUST identify the
owner of each business rule and justify any logic that remains frontend-only.

Plans and tasks MUST include security, tenant isolation, performance, and
observability work when the feature touches client data, organization data,
financial data, obligations, documents, user roles, AI, WhatsApp, Open Finance,
Acessorias, or other integrations. Features that change data models MUST include
migration, RLS, indexing, type-generation, and rollback considerations.

Frontend work MUST also evaluate UX/UI clarity, accessibility, responsiveness,
and operational efficiency for the target user. New dependencies require a
specific reason and MUST not duplicate capabilities already available through
React, TanStack Query, Supabase, shadcn/Radix, lucide-react, or existing local
helpers.

## Governance

This constitution supersedes conflicting implementation preferences, templates,
and ad hoc instructions inside the Grow Finance Hub repository. Changes to the
constitution require an explicit amendment with a Sync Impact Report, a semantic
version update, and review of dependent Spec Kit templates.

Versioning policy:
- MAJOR: removes or materially weakens a core principle or changes governance in
  a backward-incompatible way.
- MINOR: adds a new principle, mandatory section, quality gate, or materially
  expands security or scalability obligations.
- PATCH: clarifies wording without changing required behavior.

Compliance expectations:
- Specs MUST describe security, tenant scope, affected product surface, and
  measurable success criteria for relevant features.
- Plans MUST pass the Constitution Check before implementation tasks are
  generated.
- Tasks MUST include concrete validation steps and owner files for security,
  data access, performance, and observability work.
- Code delivery MUST report changed files and executed validation commands.

**Version**: 1.0.0 | **Ratified**: 2026-06-10 | **Last Amended**: 2026-06-10
