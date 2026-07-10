# Implementation Plan: Default Obligations by Tax Regime

**Branch**: `007-default-obligations` | **Date**: 2026-07-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-default-obligations/spec.md`

## Summary

Make the generic obligation matrix the system default for every newly registered company according to its tax regime: MEI, Simples Nacional, Lucro Presumido, or Lucro Real. The implementation will reuse the native Grow obligations module and governed regime-load concepts, but narrow the baseline to generic obligations only, excluding sector-specific obligations such as DMED, DIMOB, DOI, e-Financeira, and construction-specific routines. Automatic application, conditional evaluation, duplicate prevention, source tracking, and audit must remain backend-owned. The internal UI will show default-vs-manual origin, conditional skips, automatic regime-change summaries, and continue allowing users to create extra manual obligations without changing system defaults.

## Technical Context

**Language/Version**: TypeScript in React 18/Vite frontend; TypeScript/Deno for Supabase Edge Functions; SQL/Postgres migrations. Node >=22.12.0 required by the project.

**Primary Dependencies**: React Router, TanStack Query, shadcn/Radix, lucide-react, Supabase client, Supabase Edge Functions, Postgres/RLS.

**Storage**: Supabase Postgres. Existing relevant tables include `clients`, `obligation_templates`, `tax_regime_definitions`, `obligation_regime_loads`, `obligation_regime_load_items`, `client_obligation_profiles`, `obligation_instances`, `obligation_load_application_batches`, `obligation_load_application_reviews`, `obligation_load_sync_runs`, and `obligation_audit_events`.

**Testing**: Vitest for unit rules around baseline matrix, condition evaluation, duplicate prevention, and source tracking; integration tests for `grow-obligations-module` action contracts; Playwright/manual smoke for client registration and manual obligation flows. Gates: `npm run lint`, `npm run test`, `npm run build`, `npm run verify:deploy`.

**Target Platform**: Internal web app in modern browser; Supabase backend; no React Native/mobile layer.

**Project Type**: Web application with internal frontend, Supabase database, and Edge Function operational backend.

**Performance Goals**: New-company default assignment completes within 3 seconds for a company with a supported regime; reapplying defaults produces zero duplicate active links; support at least 2,000 active companies and 50 active obligation definitions per organization.

**Constraints**: Sector-specific obligations remain out of the standard regime loads. Existing completed obligations, documents, protocols, tasks, and calendar history must not be deleted or mutated when defaults are reapplied or regime changes. Conditional defaults must not be applied without positive evidence. Manual obligations must remain additive and must not mutate default definitions. System default definitions are changed only through controlled technical maintenance, not through application UI actions.

**Scale/Scope**: Internal app surfaces for client registration/editing, client detail obligations, and obligations catalog display. Supported regimes: MEI, Simples Nacional, Lucro Presumido, Lucro Real. Default matrix includes generic fiscal/labor/municipal/state obligations only.

**Affected Surfaces**: Internal app, Supabase database, Edge Function `grow-obligations-module`, client creation/update flow, native obligations catalog display, client-obligation profile application, audit events, task/calendar synchronization only when competencies are generated later. Public site and client portal management are not affected.

**Security/Tenant Scope**: Internal authenticated users can view defaults within active organization. No user role can manage system default catalog/load definitions through the application interface; authorized internal roles can manually create/link company obligations and use assignment flows where allowed. Client portal users and anonymous users are blocked. All reads/writes must resolve active organization and client ownership before mutation. No secrets or privileged keys in frontend.

**Business Rule Owner**: `grow-obligations-module` and database constraints own regime normalization, default-load lookup, conditional evaluation, duplicate prevention, profile creation/reactivation, source tracking, audit, automatic attribute-driven conditional application, and automatic regime-change application. Frontend owns UX, filters, assignment summaries, source display, and cache invalidation.

**Observability/Rollback**: Audit events and application batches record actor, organization, client, mode, source, summary, warnings, conditional skips, and automatic attribute/regime-change results. Rollback disables automatic default application and leaves existing profiles/history intact. Seed/default-load migrations must be idempotent and reversible by inactivating/removing the new generic default memberships without touching generated history.

## Constitution Check

*GATE: Passed before Phase 0 research. Re-checked after Phase 1 design: Passed.*

### Security and Least Privilege

- [x] Public, internal, and client-portal surfaces remain separated by route, role, and backend authorization.
- [x] No secrets, service-role keys, OpenAI/WhatsApp/Open Finance/Acessorias credentials, or integration tokens are exposed to client code or logs.
- [x] Privileged operations validate JWT, organization, role, client access, action intent, and input shape before using service-role access.

### Tenant Isolation and Data Segregation

- [x] New or changed operational data is organization-aware.
- [x] Client portal flows enforce client-level access through existing portal policies; this feature does not add portal management actions.
- [x] RLS, storage policies, and signed URL scope are addressed for affected tables/files. No new storage surface is required.

### Backend-Owned Business Rules

- [x] Authorization, synchronization, deduplication, automation, obligation state, conditional evidence evaluation, and default-application rules live in the responsible backend layer.
- [x] Frontend-only rules are limited to display, filtering, forms, and summaries; backend revalidates data integrity and access control.

### Scalable Frontend and Data Access

- [x] Shared/repeated remote state uses TanStack Query and existing `invokeGrowObligations` patterns.
- [x] Independent requests start early and use backend summaries to avoid unnecessary browser work.
- [x] High-volume obligation and client views use server filtering/indexes plus bounded `Map`/`Set` derived state for duplicates and membership checks.
- [x] Public routes avoid importing internal-only obligation workflows.

### Auditability, Reliability, and Operability

- [x] Operational state changes have audit/logging coverage sufficient to identify actor, organization, client, action, and source.
- [x] Default-application failures fail closed and return controlled UI errors or conditional skip summaries.
- [x] Validation commands are identified: `npm run lint`, `npm run test`, `npm run build`, `npm run verify:deploy`.
- [x] Migrations that alter critical operational tables include rollout and rollback considerations.

## Project Structure

### Documentation (this feature)

```text
specs/007-default-obligations/
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   |-- default-obligation-actions.md
|   `-- ui-contract.md
|-- checklists/
|   `-- requirements.md
`-- tasks.md
```

### Source Code (repository root)

```text
src/
|-- components/
|   `-- obligations/
|       |-- GrowObligationsWorkspace.tsx
|       `-- ClientObligationsPanel.tsx
|-- pages/
|   |-- ClientsPage.tsx
|   `-- ClientDetailPage.tsx
|-- lib/
|   |-- growObligations.ts
|   `-- obligations/
|       |-- baselineRegimeLoads.ts
|       |-- conditionalApplicability.ts
|       |-- regimeLoadContracts.ts
|       |-- regimeLoadTypes.ts
|       `-- taxRegimes.ts
|-- integrations/
|   `-- supabase/
|       `-- types.ts

supabase/
|-- functions/
|   |-- create-client-with-portal/
|   `-- grow-obligations-module/
`-- migrations/

tests/
|-- unit/
|   `-- obligations/
|-- integration/
|   `-- obligations/
`-- e2e/
```

**Structure Decision**: Reuse the existing Vite/React app and Supabase Edge Function/database structure. Keep business rules in `supabase/functions/grow-obligations-module`, shared types/helpers in `src/lib/obligations`, UI feedback in the existing internal client/obligation components, and migration/seed work under `supabase/migrations`.

## Complexity Tracking

No constitutional violations identified. The complexity is bounded to the existing obligations and client registration surfaces and is justified by the need for backend-owned deduplication, conditional skip/application logic, source tracking, auditability, and tenant-safe automatic assignment.

## Phase 0: Research

Research completed in [research.md](./research.md). Decisions:

- Reuse native obligation regime loads as the default-set mechanism.
- Keep default application backend-owned.
- Keep generic matrix only; sector-specific obligations remain manual or future specialized defaults.
- Require positive evidence for conditional obligations and auto-apply later when evidence appears.
- Keep manual obligations additive and source-tagged.
- Apply regime changes automatically for future defaults while preserving completed history.

## Phase 1: Design & Contracts

Design artifacts generated or refreshed:

- [data-model.md](./data-model.md)
- [contracts/default-obligation-actions.md](./contracts/default-obligation-actions.md)
- [contracts/ui-contract.md](./contracts/ui-contract.md)
- [quickstart.md](./quickstart.md)

The plan reference in `AGENTS.md` remains set to `specs/007-default-obligations/plan.md`.
