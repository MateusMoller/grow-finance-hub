# Tasks: Pipeline de Vendas Comercial

**Input**: Design documents from `/specs/009-sales-pipeline/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Automated tests are not explicitly requested in the specification. Tasks include validation and quality gates, with focused tests where helper behavior, tenant scope, or irreversible workflow benefits from regression coverage.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4, US5)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare the existing Vendas/CRM module for a structured sales pipeline implementation.

- [X] T001 Review current CRM persistence, UI state, and localStorage compatibility in `src/pages/CRMPage.tsx`
- [X] T002 Review existing CRM, client, and kanban task tables/RLS in `supabase/migrations/20260518103000_add_tenant_crm_tables.sql` and current task-related migrations in `supabase/migrations/`
- [X] T003 [P] Create sales domain helper shell in `src/lib/salesPipeline.ts`
- [X] T004 [P] Create component placeholders in `src/components/app/SalesPipelineBoard.tsx`, `src/components/app/SalesPipelineMetrics.tsx`, `src/components/app/SalesOpportunityDialog.tsx`, `src/components/app/SalesOpportunityDetailSheet.tsx`, `src/components/app/SalesPipelineSettingsDialog.tsx`, and `src/components/app/SalesCatalogManager.tsx`
- [X] T005 [P] Document current-to-target data mapping notes in `specs/009-sales-pipeline/migration-notes.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add backend-safe data model, tenant scope, permissions, catalog/stage management, and reusable data access before user story work.

**CRITICAL**: No user story work should begin until this phase is complete.

- [X] T006 Create Supabase migration `supabase/migrations/20260722120000_extend_sales_pipeline.sql` for opportunities, commercial leads, offers/catalog, pipeline stages, activities, commercial events, and client completion task references
- [X] T007 Add organization-aware RLS policies and tenant indexes for sales opportunities, commercial leads, offers, pipeline stages, activities, and events in `supabase/migrations/20260722120000_extend_sales_pipeline.sql`
- [X] T008 Add constraints for opportunity status transitions, lost reason, recurrence type, sale type, active offer visibility, "Outro" description, terminal stages, and task deduplication in `supabase/migrations/20260722120000_extend_sales_pipeline.sql`
- [X] T009 Add seed/backfill for default pipeline stages and default catalog offers in `supabase/migrations/20260722120000_extend_sales_pipeline.sql`
- [X] T010 Add backfill/compatibility logic from existing `crm_leads` rows to the evolved opportunity model in `supabase/migrations/20260722120000_extend_sales_pipeline.sql`
- [X] T011 Add atomic database function or secured Edge Function contract for winning a new-client opportunity, creating pending client, and creating one Commercial-sector completion task in `supabase/migrations/20260722120000_extend_sales_pipeline.sql`
- [X] T012 Add rollback notes and non-destructive migration comments in `supabase/migrations/20260722120000_extend_sales_pipeline.sql`
- [ ] T013 Regenerate Supabase TypeScript types in `src/integrations/supabase/types.ts`
- [X] T014 Implement sales constants, enums, parsers, currency helpers, stage metadata, catalog metadata, and status helpers in `src/lib/salesPipeline.ts`
- [X] T015 Implement typed query builders and mutation payload mappers for opportunities, offers, stages, leads, activities, events, pending client conversion, and completion tasks in `src/lib/salesPipeline.ts`
- [X] T016 Implement sales audit event helpers using `recordOperationalAuditLog` in `src/lib/salesPipeline.ts`
- [X] T017 Confirm Vendas permission label and route access remain consistent in `src/lib/userPermissions.ts`, `src/components/app/AppSidebar.tsx`, and `src/App.tsx`
- [X] T018 Add focused tests for sales helper parsing, status behavior, catalog permission helpers, "Outro" validation, and completion-task deduplication in `src/lib/salesPipeline.test.ts`

**Checkpoint**: Database, RLS, types, permissions, and shared helpers are ready for user stories.

---

## Phase 3: User Story 1 - Gerenciar pipeline comercial completo (Priority: P1) MVP

**Goal**: Users can view the sales pipeline, move opportunities through stages, and close active opportunities as won/lost without losing data or history.

**Independent Test**: Create an opportunity, move it between stages, mark it as won/lost, and verify that the pipeline, status, stage, responsible, value, and history remain consistent.

### Implementation for User Story 1

- [X] T019 [US1] Replace direct CRM local state loading with TanStack Query pipeline loading in `src/pages/CRMPage.tsx`
- [X] T020 [P] [US1] Implement stage column layout and empty-stage behavior using configured active/historical stages in `src/components/app/SalesPipelineBoard.tsx`
- [X] T021 [P] [US1] Implement proportional opportunity cards with client/lead, sale type, value, responsible, stage, and next-step signals in `src/components/app/SalesPipelineBoard.tsx`
- [X] T022 [US1] Wire stage movement mutations with organization-scoped updates and event creation in `src/pages/CRMPage.tsx`
- [X] T023 [US1] Implement won/lost/archive/reopen actions with controlled confirmations in `src/components/app/SalesOpportunityDetailSheet.tsx`
- [X] T024 [US1] Persist material status and stage changes to commercial events in `src/lib/salesPipeline.ts`
- [X] T025 [US1] Invalidate pipeline, metrics, stage, and detail queries after stage/status mutations in `src/pages/CRMPage.tsx`
- [X] T026 [US1] Add UX states for loading, empty pipeline, permission denial, inactive stage history, stale opportunities, and save failures in `src/pages/CRMPage.tsx`
- [ ] T027 [US1] Validate User Story 1 manually using steps 1, 6, 8, 11, and 14 from `specs/009-sales-pipeline/quickstart.md`

**Checkpoint**: MVP pipeline is functional and independently testable.

---

## Phase 4: User Story 2 - Cadastrar oportunidades para cliente existente ou novo (Priority: P1)

**Goal**: Users can create opportunities linked to existing clients or to a new commercial lead/client draft, and won new-client opportunities automatically create a pending client and Commercial-sector completion task.

**Independent Test**: Create one opportunity for an existing client and one for a new client/lead, mark the new-client opportunity as won, then verify pending client creation and exactly one active Commercial-sector completion task without individual assignee requirement.

### Implementation for User Story 2

- [X] T028 [US2] Implement client search and selection query for active clients in `src/components/app/SalesOpportunityDialog.tsx`
- [X] T029 [US2] Implement existing-client opportunity creation flow in `src/components/app/SalesOpportunityDialog.tsx`
- [X] T030 [US2] Implement new-client/commercial-lead draft fields in `src/components/app/SalesOpportunityDialog.tsx`
- [X] T031 [US2] Add duplicate warning checks against CNPJ, e-mail, and phone in `src/lib/salesPipeline.ts`
- [X] T032 [US2] Display duplicate warnings and allow intentional continuation only when user confirms in `src/components/app/SalesOpportunityDialog.tsx`
- [X] T033 [US2] Persist client/lead relationship and creation event during opportunity creation in `src/pages/CRMPage.tsx`
- [X] T034 [US2] Show clear client vs lead identity in cards and detail sheet in `src/components/app/SalesPipelineBoard.tsx` and `src/components/app/SalesOpportunityDetailSheet.tsx`
- [X] T035 [US2] Implement won-new-client conversion call that creates pending client and Commercial-sector completion task atomically in `src/lib/salesPipeline.ts`
- [X] T036 [US2] Surface pending client and completion task result after winning new-client opportunity in `src/components/app/SalesOpportunityDetailSheet.tsx`
- [X] T037 [US2] Ensure completion task is created for sector Comercial without mandatory individual responsible in `src/lib/salesPipeline.ts`
- [X] T038 [US2] Add controlled error state when pending client/task conversion fails so opportunity is not finalized as won in `src/pages/CRMPage.tsx`
- [ ] T039 [US2] Validate User Story 2 manually using steps 2, 3, 12, 13, 17, and 18 from `specs/009-sales-pipeline/quickstart.md`

**Checkpoint**: Existing-client and new-client opportunity creation and conversion work independently.

---

## Phase 5: User Story 3 - Vender produtos e servicos avulsos (Priority: P1)

**Goal**: Users can create and track opportunities for accounting services and standalone products such as automations, consultancies, and systems, using a managed catalog or "Outro".

**Independent Test**: Create opportunities for automation, consulting, system, and "Outro" offers, then verify catalog permissions, active/inactive offer behavior, value, recurrence, and historical preservation.

### Implementation for User Story 3

- [X] T040 [US3] Seed default offer categories and default active offers in `supabase/migrations/20260722120000_extend_sales_pipeline.sql`
- [X] T041 [US3] Implement offer query, active offer filtering, inactive historical offer loading, and "Outro" validation in `src/lib/salesPipeline.ts`
- [X] T042 [US3] Add sale type, offer, "Outro" description, value, recurrence, and probability controls to `src/components/app/SalesOpportunityDialog.tsx`
- [X] T043 [US3] Add sale type, offer, "Outro" description, and recurrence summary to cards in `src/components/app/SalesPipelineBoard.tsx`
- [X] T044 [US3] Add offer, "Outro" description, recurrence, and final value details to `src/components/app/SalesOpportunityDetailSheet.tsx`
- [X] T045 [US3] Build administrator/manager catalog management UI in `src/components/app/SalesCatalogManager.tsx`
- [X] T046 [US3] Add catalog settings entry and permission gating in `src/components/app/SalesPipelineSettingsDialog.tsx`
- [X] T047 [US3] Block non-manager catalog mutations in UI and rely on RLS/backend validation in `src/components/app/SalesCatalogManager.tsx`
- [X] T048 [US3] Ensure won opportunities preserve final product/service, "Outro" description, recurrence, and value in `src/lib/salesPipeline.ts`
- [ ] T049 [US3] Validate User Story 3 manually using steps 4, 5, 7, 11, 14, and 18 from `specs/009-sales-pipeline/quickstart.md`

**Checkpoint**: Product and service sales are trackable with managed catalog and "Outro".

---

## Phase 6: User Story 4 - Acompanhar atividades, follow-ups e historico da negociacao (Priority: P2)

**Goal**: Users can register activities, next steps, notes, and review a reliable timeline of each opportunity.

**Independent Test**: Add a note, create a follow-up, complete it, change opportunity fields, manage catalog/stage configuration, convert a lead, and verify activity timeline plus immutable history.

### Implementation for User Story 4

- [X] T050 [US4] Implement activities query and mutations in `src/lib/salesPipeline.ts`
- [X] T051 [US4] Build activity composer and follow-up controls in `src/components/app/SalesOpportunityDetailSheet.tsx`
- [X] T052 [US4] Build activity timeline with notes, meetings, calls, proposals, follow-ups, status changes, catalog/stage changes, and conversion events in `src/components/app/SalesOpportunityDetailSheet.tsx`
- [X] T053 [US4] Register history entries for value, stage, status, owner, close date, client, sale type, offer, "Outro" description, forecast, catalog management, stage management, and client/task conversion in `src/lib/salesPipeline.ts`
- [X] T054 [US4] Surface next-step, overdue, no-responsible, and stale-opportunity indicators in `src/components/app/SalesPipelineBoard.tsx`
- [X] T055 [US4] Add query invalidation for detail, activities, board indicators, catalog, stages, and conversion results after activity/history changes in `src/pages/CRMPage.tsx`
- [ ] T056 [US4] Validate User Story 4 manually using steps 9 and 10 from `specs/009-sales-pipeline/quickstart.md`

**Checkpoint**: Commercial context and history are available from each opportunity.

---

## Phase 7: User Story 5 - Medir desempenho comercial (Priority: P2)

**Goal**: Managers and authorized users can see reliable pipeline indicators filtered by period, owner, product, source, status, stage, configured catalog item, and "Outro".

**Independent Test**: Create opportunities across statuses, stages, offers, recurrence types, and filters, then verify that metrics and filtered lists match the selected scope.

### Implementation for User Story 5

- [X] T057 [US5] Implement metrics aggregation helpers for active value, won value, lost count, conversion, recurrence, configured catalog offers, "Outro" offers, and top opportunities in `src/lib/salesPipeline.ts`
- [X] T058 [P] [US5] Build compact metrics cards in `src/components/app/SalesPipelineMetrics.tsx`
- [X] T059 [US5] Implement filters for period, configured stage, status, owner, client, sale type, catalog offer, "Outro", source, and text search in `src/pages/CRMPage.tsx`
- [X] T060 [US5] Apply server-side or bounded query filtering for high-volume opportunity lists in `src/lib/salesPipeline.ts`
- [X] T061 [US5] Keep pipeline, list, catalog, stage, and metrics synchronized with the same filter scope in `src/pages/CRMPage.tsx`
- [X] T062 [US5] Update commercial report catalog references if the evolved sales data replaces current `site_leads`/CRM fields in `src/lib/reports/catalog.ts`
- [ ] T063 [US5] Validate User Story 5 manually using steps 15 and 16 from `specs/009-sales-pipeline/quickstart.md`

**Checkpoint**: Metrics and filters are reliable for commercial management.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Finish UX, safety, performance, and delivery validation across the module.

- [X] T064 [P] Review copy and Portuguese labels across the sales module in `src/pages/CRMPage.tsx` and `src/components/app/Sales*.tsx`
- [X] T065 [P] Review responsive behavior and dense layout usage for pipeline board, settings dialog, catalog manager, and detail sheet in `src/components/app/SalesPipelineBoard.tsx`, `src/components/app/SalesPipelineSettingsDialog.tsx`, `src/components/app/SalesCatalogManager.tsx`, and `src/components/app/SalesOpportunityDetailSheet.tsx`
- [X] T066 Optimize render paths with stable components, `Map`/`Set` indexes, and narrow memoization in `src/pages/CRMPage.tsx` and `src/lib/salesPipeline.ts`
- [X] T067 Review tenant isolation, RLS, permission behavior, atomic conversion behavior, and task deduplication for all sales reads/writes in `supabase/migrations/20260722120000_extend_sales_pipeline.sql`
- [X] T068 Review audit coverage for create, update, stage move, won, lost, archived, reopened, activity added, follow-up completed, stage management, catalog management, pending client creation, and completion task creation in `src/lib/salesPipeline.ts`
- [ ] T069 Run full quickstart validation from `specs/009-sales-pipeline/quickstart.md`
- [X] T070 Run `npm run lint`
- [X] T071 Run `npm run test`
- [X] T072 Run `npm run build`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately.
- **Foundational (Phase 2)**: Depends on Setup; blocks all user stories.
- **US1 Pipeline MVP (Phase 3)**: Depends on Foundational.
- **US2 Client Existing/New (Phase 4)**: Depends on Foundational and core opportunity mutations; conversion flow depends on task/client schema from T011.
- **US3 Products/Services (Phase 5)**: Depends on Foundational; can run alongside US2 after offer/catalog schema exists.
- **US4 Activities/History (Phase 6)**: Depends on US1 opportunity detail and movement; benefits from US2/US3 events.
- **US5 Metrics/Filters (Phase 7)**: Depends on US1 and benefits from US3 offer fields.
- **Polish (Phase 8)**: Depends on selected user stories being complete.

### User Story Dependencies

- **US1 (P1)**: MVP after Foundational; no dependency on other stories.
- **US2 (P1)**: Can start after Foundational; integrates with US1 board/detail and task/client conversion backend.
- **US3 (P1)**: Can start after Foundational; integrates with US1 board/detail and US2 creation.
- **US4 (P2)**: Requires US1 detail and core opportunity mutations.
- **US5 (P2)**: Requires US1 opportunity data and US3 offer/stage fields for complete metrics.

### Parallel Opportunities

- T003, T004, and T005 can run in parallel.
- T020 and T021 can run in parallel after T019 defines the board data shape.
- T028 and T031 can run in parallel after foundational data helpers exist.
- T041 and T045 can run in parallel after offer schema exists.
- T058 can run in parallel with T057 once metric props are agreed.
- T064 and T065 can run in parallel during polish.

---

## Parallel Example: User Story 1

```text
Task: "Implement stage column layout and empty-stage behavior using configured active/historical stages in src/components/app/SalesPipelineBoard.tsx"
Task: "Implement proportional opportunity cards with client/lead, sale type, value, responsible, stage, and next-step signals in src/components/app/SalesPipelineBoard.tsx"
```

## Parallel Example: User Story 2

```text
Task: "Implement client search and selection query for active clients in src/components/app/SalesOpportunityDialog.tsx"
Task: "Add duplicate warning checks against CNPJ, e-mail, and phone in src/lib/salesPipeline.ts"
```

## Parallel Example: User Story 3

```text
Task: "Implement offer query, active offer filtering, inactive historical offer loading, and Outro validation in src/lib/salesPipeline.ts"
Task: "Build administrator/manager catalog management UI in src/components/app/SalesCatalogManager.tsx"
```

## Parallel Example: User Story 5

```text
Task: "Implement metrics aggregation helpers for active value, won value, lost count, conversion, recurrence, configured catalog offers, Outro offers, and top opportunities in src/lib/salesPipeline.ts"
Task: "Build compact metrics cards in src/components/app/SalesPipelineMetrics.tsx"
```

---

## Implementation Strategy

### MVP First

1. Complete Setup and Foundational phases.
2. Implement US1 only: pipeline loading, board, configured stages, stage movement, won/lost flow, and history.
3. Validate US1 independently with quickstart steps.
4. Continue with US2 and US3 to cover client creation/conversion and product/service sales.

### Incremental Delivery

1. Foundation: migration, RLS, types, helpers, stages, catalog, atomic conversion.
2. US1: operational pipeline.
3. US2: client existing/new creation and pending-client/task conversion.
4. US3: products, services, catalog, and "Outro".
5. US4: activities and history.
6. US5: metrics and filters.
7. Polish: UX, performance, security review, validation gates.

### Validation Commands

```powershell
npm run lint
npm run test
npm run build
```

## Notes

- Keep changes non-destructive for existing `crm_leads` data.
- Do not expose sales data to the public site or client portal in this feature.
- Keep business-critical authorization, conversion, deduplication, and tenant rules backed by RLS/database constraints or secured backend function.
- Avoid adding new dependencies unless an existing project tool cannot reasonably cover the need.
