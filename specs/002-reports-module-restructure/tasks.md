# Tasks: Reestruturacao Profissional do Modulo de Relatorios

**Input**: Design documents from `specs/002-reports-module-restructure/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Include focused Vitest/Playwright tasks because this feature touches permission, tenant scope, sensitive exports, saved model integrity and high-volume report behavior.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently after the foundational phase.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files or depends only on completed prerequisites
- **[Story]**: User story label from `spec.md`
- Every task includes exact target file path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create report feature structure and preserve current behavior before refactor.

- [x] T001 Create report feature directories in `src/lib/reports/`, `src/components/reports/`, `src/hooks/reports/`, `tests/unit/reports/`, `tests/integration/reports/`, and `tests/e2e/reports/`
- [x] T002 [P] Create report domain barrel placeholders in `src/lib/reports/index.ts` and `src/components/reports/index.ts`
- [x] T003 [P] Add feature implementation notes stub in `docs/reports/reports-module-restructure.md`
- [x] T004 Capture current report datasets, default columns and saved model behavior notes in `docs/reports/current-reports-inventory.md`
- [x] T005 [P] Add test fixture scaffolding for report rows and roles in `tests/fixtures/reports/reportFixtures.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish shared catalog, security, tenant, persistence and API foundations that all stories rely on.

**CRITICAL**: No user story implementation should begin until this phase is complete.

- [x] T006 Define report domain types for datasets, fields, filters, classifications, previews, exports and saved models in `src/lib/reports/types.ts`
- [x] T007 [P] Define data classification constants and prohibited-field matchers in `src/lib/reports/classification.ts`
- [x] T008 [P] Define report role and dataset permission helpers in `src/lib/reports/permissions.ts`
- [x] T009 Build initial governed dataset catalog for Clientes, Leads e CRM, Tarefas and Equipe in `src/lib/reports/catalog.ts`
- [x] T010 Add catalog validation utilities for duplicate keys, missing classification, invalid defaults and prohibited fields in `src/lib/reports/catalogValidation.ts`
- [x] T011 [P] Add Vitest coverage for catalog validation and prohibited field blocking in `tests/unit/reports/catalogValidation.test.ts`
- [x] T012 Create saved report normalization and column sanitization helpers in `src/lib/reports/savedReports.ts`
- [x] T013 [P] Add Vitest coverage for saved report normalization and stale column diagnostics in `tests/unit/reports/savedReports.test.ts`
- [x] T014 Create report filter normalization and active filter summary helpers in `src/lib/reports/filters.ts`
- [x] T015 [P] Add Vitest coverage for organization, company and competence filter normalization in `tests/unit/reports/filters.test.ts`
- [x] T016 Create migration for `saved_reports` tenant hardening, normalized names, indexes, and RLS updates in `supabase/migrations/20260612090000_harden_saved_reports_for_reports_module.sql`
- [x] T017 Create migration notes and rollback checklist for reports persistence changes in `docs/reports/reports-migration-rollout.md`
- [x] T018 Define report audit metadata builder using existing operational audit shape in `src/lib/reports/audit.ts`
- [x] T019 [P] Add Vitest coverage for audit metadata redaction in `tests/unit/reports/audit.test.ts`
- [x] T020 Create Supabase Edge Function skeleton for sensitive report export validation in `supabase/functions/report-exports/index.ts`
- [x] T021 [P] Create shared report export validation types for Edge Function in `supabase/functions/report-exports/types.ts`
- [x] T022 Add Edge Function README with authorization, volume limit and rollback behavior in `supabase/functions/report-exports/README.md`
- [x] T023 Update Supabase generated/local type expectations for report persistence notes in `src/integrations/supabase/types.ts`
- [x] T024 Add report query key factory for TanStack Query cache boundaries in `src/hooks/reports/reportQueryKeys.ts`

**Checkpoint**: Catalog, permissions, saved model validation, audit metadata, tenant migration plan and export function skeleton exist.

---

## Phase 3: User Story 1 - Gerar relatorios confiaveis com escopo correto (Priority: P1) MVP

**Goal**: Authorized internal users can select a dataset, see correct scoped preview data and export only rows/fields allowed by active filters and permissions.

**Independent Test**: Access reports with different roles, select datasets and filters, compare preview/export samples with source records, and confirm unauthorized data does not appear.

### Tests for User Story 1

- [x] T025 [P] [US1] Add unit tests for dataset permission filtering in `tests/unit/reports/permissions.test.ts`
- [x] T026 [P] [US1] Add integration tests for Clientes/Tarefas row builders applying filters in `tests/integration/reports/reportRows.test.ts`
- [x] T027 [P] [US1] Add Playwright scenario for admin preview with active filters in `tests/e2e/reports/reports-preview.spec.ts`

### Implementation for User Story 1

- [x] T028 [P] [US1] Extract current cell formatting helpers from `src/pages/RelatoriosPage.tsx` into `src/lib/reports/formatters.ts`
- [x] T029 [P] [US1] Implement report row builders for Clientes, Leads e CRM, Tarefas and Equipe in `src/lib/reports/rowBuilders.ts`
- [x] T030 [US1] Implement scoped report preview service using catalog, filters and permissions in `src/lib/reports/previewService.ts`
- [x] T031 [US1] Implement `useReportCatalog` and `useReportPreview` hooks with TanStack Query in `src/hooks/reports/useReports.ts`
- [x] T032 [P] [US1] Create dataset selector component with permission-filtered options in `src/components/reports/ReportDatasetSelector.tsx`
- [x] T033 [P] [US1] Create active filter summary component in `src/components/reports/ReportFilterSummary.tsx`
- [x] T034 [P] [US1] Create bounded preview table component in `src/components/reports/ReportPreviewTable.tsx`
- [x] T035 [US1] Refactor `src/pages/RelatoriosPage.tsx` to compose report catalog, filter summary and preview components without all-at-once dataset loading
- [x] T036 [US1] Add permission denied, empty result and partial dataset failure states in `src/pages/RelatoriosPage.tsx`
- [x] T037 [US1] Ensure report route remains internal and feature-flag gated in `src/App.tsx` and `src/components/app/ProtectedRoute.tsx`

**Checkpoint**: User Story 1 is fully functional and testable independently as the MVP.

---

## Phase 4: User Story 2 - Montar modelos reutilizaveis e governados (Priority: P1)

**Goal**: Users can save, load, edit and delete personal report models with valid columns, stable ordering, duplicate detection and stale-field diagnostics.

**Independent Test**: Create a model, reload the page, edit columns, rename it, generate from it and verify stale or unauthorized columns are reported instead of silently exported.

### Tests for User Story 2

- [x] T038 [P] [US2] Add integration tests for saved report CRUD and duplicate name handling in `tests/integration/reports/savedReports.test.ts`
- [x] T039 [P] [US2] Add Playwright scenario for save, load, edit and delete model flow in `tests/e2e/reports/reports-saved-models.spec.ts`

### Implementation for User Story 2

- [x] T040 [US2] Implement saved report repository functions with organization scope in `src/lib/reports/savedReportRepository.ts`
- [x] T041 [US2] Implement `useSavedReports` hook with TanStack Query mutations and invalidation in `src/hooks/reports/useSavedReports.ts`
- [x] T042 [P] [US2] Create saved model form component in `src/components/reports/SavedReportForm.tsx`
- [x] T043 [P] [US2] Create saved model list component in `src/components/reports/SavedReportList.tsx`
- [x] T044 [P] [US2] Create stale model warning component in `src/components/reports/SavedReportWarnings.tsx`
- [x] T045 [US2] Integrate saved model create, load, edit and delete flows into `src/pages/RelatoriosPage.tsx`
- [x] T046 [US2] Record saved model create, update and delete audit metadata in `src/lib/reports/savedReportRepository.ts`
- [x] T047 [US2] Add accessible confirmation dialog for model deletion in `src/components/reports/SavedReportDeleteDialog.tsx`

**Checkpoint**: User Story 2 works independently with personal saved models and catalog validation.

---

## Phase 5: User Story 3 - Exportar dados sensiveis com seguranca e rastreabilidade (Priority: P1)

**Goal**: Sensitive and high-volume report exports are authorized at generation time, blocked when unsafe, and audited without leaking report contents.

**Independent Test**: Generate low- and high-sensitivity reports, verify permission checks, prohibited field blocking, audit metadata, volume limits and controlled failure messages.

### Tests for User Story 3

- [x] T048 [P] [US3] Add Edge Function validation tests for report export payloads in `tests/integration/reports/reportExports.test.ts`
- [x] T049 [P] [US3] Add unit tests for export eligibility and volume decisions in `tests/unit/reports/exportPolicy.test.ts`
- [x] T050 [P] [US3] Add Playwright scenario for blocked prohibited field and large export messaging in `tests/e2e/reports/reports-export-security.spec.ts`

### Implementation for User Story 3

- [x] T051 [P] [US3] Implement export policy helpers for classification, volume limits and backend-required decisions in `src/lib/reports/exportPolicy.ts`
- [x] T052 [US3] Implement report export client that routes sensitive exports to Edge Function in `src/lib/reports/exportClient.ts`
- [x] T053 [US3] Implement authorization, catalog validation and audit recording in `supabase/functions/report-exports/index.ts`
- [x] T054 [US3] Implement XLSX generation path for approved low-risk direct exports in `src/lib/reports/xlsxExport.ts`
- [x] T055 [US3] Add export status, blocked, running and failed states to `src/components/reports/ReportExportControls.tsx`
- [x] T056 [US3] Integrate export controls and backend export responses into `src/pages/RelatoriosPage.tsx`
- [x] T057 [US3] Ensure operational audit redacts filters and column metadata safely in `src/lib/reports/audit.ts`
- [x] T058 [US3] Document sensitive export runbook and investigation fields in `docs/reports/report-export-audit-runbook.md`

**Checkpoint**: User Story 3 works independently for secure export and audit behavior.

---

## Phase 6: User Story 4 - Administrar catalogo de bases e campos de relatorio (Priority: P2)

**Goal**: Technical owners can evolve the report catalog safely with explicit dataset ownership, source, fields, classification and permission behavior.

**Independent Test**: Review each dataset, field classification, source, permission rule and behavior when an origin is missing or changed.

### Tests for User Story 4

- [x] T059 [P] [US4] Add snapshot-style catalog contract tests for all initial datasets in `tests/unit/reports/catalog.contract.test.ts`
- [x] T060 [P] [US4] Add tests for field grouping and search metadata in `tests/unit/reports/fieldSearch.test.ts`

### Implementation for User Story 4

- [x] T061 [US4] Add catalog governance metadata for owner, source, required filters and review notes in `src/lib/reports/catalog.ts`
- [x] T062 [P] [US4] Implement report field grouping and search index helpers in `src/lib/reports/fieldSearch.ts`
- [x] T063 [P] [US4] Create field browser component with module/subfolder grouping in `src/components/reports/ReportFieldBrowser.tsx`
- [x] T064 [P] [US4] Create selected field ordering component in `src/components/reports/SelectedReportFields.tsx`
- [x] T065 [US4] Integrate field browser and selected field ordering into `src/pages/RelatoriosPage.tsx`
- [x] T066 [US4] Document process for adding new report datasets and fields in `docs/reports/report-catalog-governance.md`

**Checkpoint**: User Story 4 provides a governed path to maintain and extend the catalog.

---

## Phase 7: User Story 5 - Operar relatorios com desempenho previsivel (Priority: P2)

**Goal**: Report previews, column search, filters and exports remain responsive under representative production volumes.

**Independent Test**: Use large fixtures to measure opening the module, applying filters, searching fields, rendering preview and initiating export.

### Tests for User Story 5

- [x] T067 [P] [US5] Add large dataset fixture generator for report performance tests in `tests/fixtures/reports/largeReportFixtures.ts`
- [x] T068 [P] [US5] Add unit performance guard for field search over 500 fields in `tests/unit/reports/fieldSearch.performance.test.ts`
- [x] T069 [P] [US5] Add integration test for independent dataset failure handling in `tests/integration/reports/partialFailure.test.ts`

### Implementation for User Story 5

- [x] T070 [US5] Optimize preview derivation to use precomputed maps and selected field sets in `src/lib/reports/previewService.ts`
- [x] T071 [US5] Add independent query status handling per dataset in `src/hooks/reports/useReports.ts`
- [x] T072 [US5] Add content visibility or bounded rendering behavior for dense field lists in `src/components/reports/ReportFieldBrowser.tsx`
- [x] T073 [US5] Add export progress and retry-safe failure copy in `src/components/reports/ReportExportControls.tsx`
- [x] T074 [US5] Document measured volume assumptions and thresholds in `docs/reports/reports-performance-baseline.md`

**Checkpoint**: User Story 5 validates predictable operation at representative volume.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final verification, cleanup, documentation and deployment safety across all stories.

- [x] T075 [P] Update manual/help content for the restructured reports module in `src/lib/manual/content.ts`
- [x] T076 [P] Add release notes for reports restructure in `docs/reports/reports-release-notes.md`
- [x] T077 Run accessibility review for report controls and fix issues in `src/components/reports/ReportDatasetSelector.tsx`, `src/components/reports/ReportFieldBrowser.tsx`, and `src/components/reports/ReportExportControls.tsx`
- [x] T078 Run tenant isolation review for report RLS, Edge Function and saved models in `docs/reports/reports-tenant-isolation-review.md`
- [x] T079 Run security review for prohibited fields and export audit in `docs/reports/reports-security-review.md`
- [x] T080 Run quickstart validation scenarios and record results in `docs/reports/reports-quickstart-validation.md`
- [x] T081 Run `npm run lint` and record result in `docs/reports/reports-validation-results.md`
- [x] T082 Run `npm run test` and record result in `docs/reports/reports-validation-results.md`
- [x] T083 Run `npm run build` and record result in `docs/reports/reports-validation-results.md`
- [x] T084 Run `npm run verify:deploy` when environment variables are available and record result in `docs/reports/reports-validation-results.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup completion and blocks all user stories.
- **US1 (Phase 3)**: Depends on Foundation; recommended MVP.
- **US2 (Phase 4)**: Depends on Foundation; can run after or alongside US1 after shared hooks/catalog exist.
- **US3 (Phase 5)**: Depends on Foundation; can run after or alongside US1 but final UI integration benefits from US1 export controls.
- **US4 (Phase 6)**: Depends on Foundation; can run alongside US1/US2/US3 after catalog base exists.
- **US5 (Phase 7)**: Depends on Foundation and benefits from US1/US4 implementation.
- **Polish (Phase 8)**: Depends on completed target stories.

### User Story Dependencies

- **User Story 1 (P1)**: MVP; no dependency on other stories after Foundation.
- **User Story 2 (P1)**: Uses catalog/saved report foundation; independent from export security.
- **User Story 3 (P1)**: Uses catalog, permissions and audit foundation; independent from saved model UX.
- **User Story 4 (P2)**: Extends catalog governance; can be implemented after foundational catalog exists.
- **User Story 5 (P2)**: Depends on performance-sensitive paths from US1/US4 for full validation.

### Within Each User Story

- Tests first where listed.
- Domain/lib helpers before hooks.
- Hooks before page integration.
- Components before final page composition.
- Backend authorization/audit before sensitive export UI is considered complete.

---

## Parallel Opportunities

- T002, T003 and T005 can run in parallel after T001.
- T007, T008, T011, T013, T015, T019, T021 can run in parallel once T006 exists.
- US1 tests T025, T026 and T027 can run in parallel.
- US1 components T032, T033 and T034 can run in parallel after hooks/contracts are clear.
- US2 components T042, T043 and T044 can run in parallel after T041.
- US3 tests T048, T049 and T050 can run in parallel; T051 and T054 can run before final Edge Function integration.
- US4 tasks T062, T063 and T064 can run in parallel after T061.
- US5 tasks T067, T068 and T069 can run in parallel.

## Parallel Example: User Story 1

```text
Task: "T025 [P] [US1] Add unit tests for dataset permission filtering in tests/unit/reports/permissions.test.ts"
Task: "T026 [P] [US1] Add integration tests for Clientes/Tarefas row builders applying filters in tests/integration/reports/reportRows.test.ts"
Task: "T027 [P] [US1] Add Playwright scenario for admin preview with active filters in tests/e2e/reports/reports-preview.spec.ts"
Task: "T032 [P] [US1] Create dataset selector component with permission-filtered options in src/components/reports/ReportDatasetSelector.tsx"
Task: "T033 [P] [US1] Create active filter summary component in src/components/reports/ReportFilterSummary.tsx"
Task: "T034 [P] [US1] Create bounded preview table component in src/components/reports/ReportPreviewTable.tsx"
```

## Parallel Example: User Story 3

```text
Task: "T048 [P] [US3] Add Edge Function validation tests for report export payloads in tests/integration/reports/reportExports.test.ts"
Task: "T049 [P] [US3] Add unit tests for export eligibility and volume decisions in tests/unit/reports/exportPolicy.test.ts"
Task: "T050 [P] [US3] Add Playwright scenario for blocked prohibited field and large export messaging in tests/e2e/reports/reports-export-security.spec.ts"
Task: "T051 [P] [US3] Implement export policy helpers for classification, volume limits and backend-required decisions in src/lib/reports/exportPolicy.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 Setup.
2. Complete Phase 2 Foundation.
3. Complete Phase 3 User Story 1.
4. Validate that authorized internal users can preview scoped report data and unauthorized data is blocked.
5. Stop and demo before model persistence and secure export expansion if needed.

### Incremental Delivery

1. Foundation -> US1: correct scoped previews.
2. US2: governed personal saved models.
3. US3: secure audited exports.
4. US4: catalog governance and maintainability.
5. US5: performance hardening and partial failure behavior.
6. Polish: docs, validation commands and rollout evidence.

### Risk Controls

- Do not fallback to unsafe browser export for sensitive datasets if Edge Function export fails.
- Preserve existing saved model records during migration; show diagnostics for invalid models instead of deleting them.
- Treat `client` role as blocked for internal reports throughout implementation.
- Keep public site and portal client bundles free from report internals.

---

## Notes

- `[P]` tasks are safe to parallelize by file ownership after dependencies are met.
- `[US#]` labels trace tasks back to the feature spec user stories.
- All sensitive authorization decisions must be backed by Supabase RLS/RPC/Edge Function behavior, not UI-only checks.
- Commit only logical groups and avoid including unrelated existing changes in `src/components/obligations/GrowObligationsWorkspace.tsx`.
