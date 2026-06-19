# Tasks: Cargas Padrao de Obrigacoes por Regime Tributario

**Input**: Design documents from `specs/003-obligation-regime-loads/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Include focused Vitest, integration and Playwright tasks because this feature changes obligation automation, tenant-scoped operational data, duplicate prevention, standard-load synchronization and client onboarding behavior.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently after the foundational phase.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files or depends only on completed prerequisites
- **[Story]**: User story label from `spec.md`
- Every task includes exact target file path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare feature structure, fixtures and documentation stubs without changing runtime behavior.

- [X] T001 Create obligation regime feature directories in `src/lib/obligations/`, `src/hooks/obligations/`, `src/components/obligations/regime-loads/`, `tests/unit/obligations/`, `tests/integration/obligations/`, and `tests/e2e/obligations/`
- [X] T002 [P] Create obligation regime helper barrel in `src/lib/obligations/index.ts`
- [X] T003 [P] Create obligation hooks barrel in `src/hooks/obligations/index.ts`
- [X] T004 [P] Create regime load component barrel in `src/components/obligations/regime-loads/index.ts`
- [X] T005 [P] Add implementation notes stub for the feature in `docs/obligations/obligation-regime-loads.md`
- [X] T006 [P] Add rollout and rollback notes stub in `docs/obligations/obligation-regime-loads-rollout.md`
- [X] T007 [P] Add test fixture scaffolding for regimes, templates, loads, clients, branches and sync runs in `tests/fixtures/obligations/regimeLoadFixtures.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish schema, domain helpers, seed inventory, contracts and backend boundaries that all stories require.

**CRITICAL**: No user story implementation should begin until this phase is complete.

- [X] T008 Define shared TypeScript domain types for tax regimes, regime loads, load items, application batches, reviews, sync runs and duplicate diagnostics in `src/lib/obligations/regimeLoadTypes.ts`
- [X] T009 [P] Define tax regime normalization and alias helpers for Simples Nacional, Lucro Presumido, Lucro Real, MEI and branch inherited-regime cases in `src/lib/obligations/taxRegimes.ts`
- [X] T010 [P] Define obligation name/code normalization and duplicate matching helpers in `src/lib/obligations/obligationDeduplication.ts`
- [X] T011 [P] Define conditional applicability evaluator for employee, ISS, ICMS, service provider, accounting contracted and insufficient-evidence cases in `src/lib/obligations/conditionalApplicability.ts`
- [X] T012 [P] Define baseline obligation seed catalog grouped by shared, Simples Nacional, Lucro Presumido, Lucro Real and MEI with required/optional/conditional applicability in `src/lib/obligations/baselineRegimeLoads.ts`
- [X] T013 [P] Add unit tests for tax regime normalization and branch inherited-regime behavior in `tests/unit/obligations/taxRegimes.test.ts`
- [X] T014 [P] Add unit tests for obligation duplicate matching in `tests/unit/obligations/obligationDeduplication.test.ts`
- [X] T015 [P] Add unit tests for conditional applicability apply/skip/review decisions in `tests/unit/obligations/conditionalApplicability.test.ts`
- [X] T016 [P] Add unit tests that assert shared obligations such as FGTS are represented once across baseline loads in `tests/unit/obligations/baselineRegimeLoads.test.ts`
- [X] T017 Create Supabase migration for `tax_regime_definitions`, `obligation_regime_loads`, `obligation_regime_load_items`, `obligation_load_application_batches`, `obligation_load_application_reviews`, `obligation_load_sync_runs`, profile source/sync columns, template duplicate columns, indexes and RLS in `supabase/migrations/20260619090000_add_obligation_regime_loads.sql`
- [X] T018 Add idempotent baseline seed data for master obligations and regime loads with conditional `condition_key` values in `supabase/migrations/20260619090000_add_obligation_regime_loads.sql`
- [X] T019 Add migration rollback and validation checklist details for load sync disabling and history preservation in `docs/obligations/obligation-regime-loads-rollout.md`
- [X] T020 Update Supabase local/generated type expectations for new obligation regime tables, sync runs and profile columns in `src/integrations/supabase/types.ts`
- [X] T021 Extend `GrowObligationTemplate`, `GrowObligationProfile` and overview payload types with load/source/sync/conditional review fields in `src/lib/growObligations.ts`
- [X] T022 Add regime load action request/response types for `grow-obligations-module` contracts including `sync_regime_load_existing_clients` in `src/lib/obligations/regimeLoadContracts.ts`
- [X] T023 Add integration contract tests for `list_regime_loads`, `upsert_regime_load`, `upsert_regime_load_item`, `preview_apply_regime_load`, `apply_regime_load`, `sync_regime_load_existing_clients` and `detect_obligation_duplicates` in `tests/integration/obligations/regimeLoadContracts.test.ts`
- [X] T024 Add backend audit metadata builder for obligation catalog, load, application and sync events in `src/lib/obligations/obligationAudit.ts`
- [X] T025 [P] Add unit tests for obligation audit metadata redaction, sync summaries and before/after summaries in `tests/unit/obligations/obligationAudit.test.ts`
- [X] T026 Document baseline obligation ownership, conditional evidence rules and fiscal review assumptions in `docs/obligations/obligation-regime-loads.md`

**Checkpoint**: Schema design, baseline data, domain helpers, contracts, types, conditional rules, sync runs and audit model are ready.

---

## Phase 3: User Story 1 - Vincular carga ao cadastrar empresa (Priority: P1) MVP

**Goal**: New companies with a supported tax regime automatically receive active standard-load links without duplicate client-obligation links, without generating competencies/tasks/calendar events.

**Independent Test**: Create one company per supported regime and confirm each receives expected active links once, source `standard_load`, conditional review warnings where evidence is missing, and no generated competencies.

### Tests for User Story 1

- [ ] T027 [P] [US1] Add integration test for new-client automatic load link application for Simples Nacional, Lucro Presumido, Lucro Real and MEI in `tests/integration/obligations/applyRegimeLoadNewClient.test.ts`
- [ ] T028 [P] [US1] Add integration test proving new-client load application does not create competencies, tasks or calendar events in `tests/integration/obligations/applyRegimeLoadNoCompetencies.test.ts`
- [ ] T029 [P] [US1] Add integration test for conditional items becoming review warnings when client evidence is insufficient in `tests/integration/obligations/applyRegimeLoadConditionals.test.ts`
- [ ] T030 [P] [US1] Add integration test for missing active load controlled warning without corrupting client creation in `tests/integration/obligations/applyRegimeLoadMissingLoad.test.ts`
- [ ] T031 [P] [US1] Add Playwright scenario for new company creation showing load application summary, conditional warnings and no automatic competency generation in `tests/e2e/obligations/new-client-regime-load.spec.ts`

### Implementation for User Story 1

- [ ] T032 [US1] Implement backend regime lookup, branch regime resolution and active load loading helpers in `supabase/functions/grow-obligations-module/index.ts`
- [ ] T033 [US1] Implement backend conditional applicability evaluation for load application in `supabase/functions/grow-obligations-module/index.ts`
- [ ] T034 [US1] Implement backend load application planner for `new_client` mode with add/keep/skip/review decisions in `supabase/functions/grow-obligations-module/index.ts`
- [ ] T035 [US1] Implement backend `apply_regime_load` action for automatic new-client link application without competency generation in `supabase/functions/grow-obligations-module/index.ts`
- [ ] T036 [US1] Add backend audit event writes for new-client load application batches and conditional review warnings in `supabase/functions/grow-obligations-module/index.ts`
- [ ] T037 [US1] Extend `create-client-with-portal` response to include obligation load application summary, skipped items and conditional warnings in `supabase/functions/create-client-with-portal/index.ts`
- [ ] T038 [US1] Invoke new-client regime load application after client creation without generating instances in `supabase/functions/create-client-with-portal/index.ts`
- [ ] T039 [US1] Update client creation response typing and warning parsing in `src/pages/ClientsPage.tsx`
- [ ] T040 [US1] Show load application success, skipped count, conditional review count and missing-load warning in the new client flow in `src/pages/ClientsPage.tsx`
- [ ] T041 [US1] Add source, batch, sync and conditional review fields to client obligation snapshot mapping in `supabase/functions/grow-obligations-module/index.ts`
- [ ] T042 [US1] Display obligation source and conditional review badges in the client obligations list in `src/components/obligations/ClientObligationsPanel.tsx`

**Checkpoint**: User Story 1 is fully functional and testable as the MVP.

---

## Phase 4: User Story 2 - Gerenciar cargas por regime (Priority: P1)

**Goal**: Managers can review, maintain and publish standard loads per regime while reusing one master obligation across multiple regimes and automatically synchronizing active/future links for existing clients.

**Independent Test**: Open the catalog, switch regimes, add/remove a master obligation, publish the active load and verify FGTS remains one master obligation and existing same-regime clients receive active/future link sync without changes to generated history.

### Tests for User Story 2

- [ ] T043 [P] [US2] Add integration tests for `list_regime_loads` returning regimes, loads, items, templates, sync status and duplicate warnings in `tests/integration/obligations/listRegimeLoads.test.ts`
- [ ] T044 [P] [US2] Add integration tests for creating/updating regime loads and enforcing one active load per regime in `tests/integration/obligations/upsertRegimeLoad.test.ts`
- [ ] T045 [P] [US2] Add integration tests for adding/removing load items without duplicating the same template in one load in `tests/integration/obligations/upsertRegimeLoadItem.test.ts`
- [ ] T046 [P] [US2] Add integration tests for published active load changes synchronizing existing clients without mutating generated competencies in `tests/integration/obligations/syncRegimeLoadExistingClients.test.ts`
- [ ] T047 [P] [US2] Add integration tests for branch inherited-regime clients becoming review-required during sync in `tests/integration/obligations/syncRegimeLoadBranches.test.ts`
- [ ] T048 [P] [US2] Add Playwright scenario for catalog regime load management and sync summary in `tests/e2e/obligations/catalog-regime-loads.spec.ts`

### Implementation for User Story 2

- [X] T049 [US2] Implement backend `list_regime_loads` action with organization scope, role checks, sync run summaries and duplicate warnings in `supabase/functions/grow-obligations-module/index.ts`
- [ ] T050 [US2] Implement backend `upsert_regime_load` action with active-load validation and publish detection in `supabase/functions/grow-obligations-module/index.ts`
- [X] T051 [US2] Implement backend `upsert_regime_load_item` action with conditional applicability validation in `supabase/functions/grow-obligations-module/index.ts`
- [ ] T052 [US2] Implement backend `sync_regime_load_existing_clients` action with bounded processing and active/future-link-only updates in `supabase/functions/grow-obligations-module/index.ts`
- [ ] T053 [US2] Add backend audit event writes for regime load changes, load item changes and sync runs in `supabase/functions/grow-obligations-module/index.ts`
- [ ] T054 [P] [US2] Create TanStack Query hooks for listing, mutating and publishing/syncing regime loads in `src/hooks/obligations/useRegimeLoads.ts`
- [ ] T055 [P] [US2] Create regime load selector component with status, counts and latest sync summary in `src/components/obligations/regime-loads/RegimeLoadSelector.tsx`
- [ ] T056 [P] [US2] Create regime load item table with applicability, condition, active state and remove action in `src/components/obligations/regime-loads/RegimeLoadItemsTable.tsx`
- [ ] T057 [P] [US2] Create master obligation picker that reuses existing templates and shows duplicate warnings in `src/components/obligations/regime-loads/MasterObligationPicker.tsx`
- [ ] T058 [P] [US2] Create regime load form dialog for status, owner, review notes, effective dates and publish confirmation in `src/components/obligations/regime-loads/RegimeLoadFormDialog.tsx`
- [ ] T059 [P] [US2] Create sync summary panel for processed, created, skipped, review-required and history-unchanged counts in `src/components/obligations/regime-loads/RegimeLoadSyncSummary.tsx`
- [ ] T060 [US2] Integrate regime load selector, item table, picker, form and sync summary into the catalog tab in `src/components/obligations/GrowObligationsWorkspace.tsx`
- [ ] T061 [US2] Add bounded search/filter state for obligations by regime, sector, status, condition and duplicate risk in `src/components/obligations/GrowObligationsWorkspace.tsx`
- [ ] T062 [US2] Update obligation regime load documentation with management, publish and sync behavior in `docs/obligations/obligation-regime-loads.md`

**Checkpoint**: User Story 2 works independently for governed load management and automatic active/future sync.

---

## Phase 5: User Story 3 - Editar obrigacoes individualmente por cliente (Priority: P1)

**Goal**: Users can adjust a client's obligations after standard load application without changing the global load or other clients.

**Independent Test**: Apply a load to a client, change one due override, inactivate one obligation and add one manual obligation; confirm other clients, regime loads and generated history remain unchanged.

### Tests for User Story 3

- [ ] T063 [P] [US3] Add integration tests for client-specific due overrides preserving load defaults in `tests/integration/obligations/clientProfileOverrides.test.ts`
- [ ] T064 [P] [US3] Add integration tests for manual additions and individual inactivation source tracking in `tests/integration/obligations/clientProfileSource.test.ts`
- [ ] T065 [P] [US3] Add integration tests proving individual inactivation stops future generation but leaves generated instances unchanged in `tests/integration/obligations/clientProfileHistoryPreservation.test.ts`
- [ ] T066 [P] [US3] Add Playwright scenario for editing an individual client obligation after load application in `tests/e2e/obligations/client-obligation-exceptions.spec.ts`

### Implementation for User Story 3

- [ ] T067 [US3] Extend backend `upsert_profile` action to preserve and validate `source_kind`, `source_load_id`, `source_load_item_id`, `application_batch_id`, `sync_status`, `conditional_review_reason` and `inactivation_reason` in `supabase/functions/grow-obligations-module/index.ts`
- [ ] T068 [US3] Add backend validation so manual client profile changes cannot mutate regime load definitions or generated instances in `supabase/functions/grow-obligations-module/index.ts`
- [ ] T069 [US3] Add backend audit event writes for manual additions, overrides and individual inactivation in `supabase/functions/grow-obligations-module/index.ts`
- [ ] T070 [US3] Extend `GrowObligationProfile` typing with source, sync, conditional and inactivation metadata in `src/lib/growObligations.ts`
- [ ] T071 [P] [US3] Create client obligation edit dialog for due overrides, notes and active state in `src/components/obligations/regime-loads/ClientObligationEditDialog.tsx`
- [ ] T072 [P] [US3] Create obligation source/sync badge tooltip component in `src/components/obligations/regime-loads/ObligationSourceBadge.tsx`
- [ ] T073 [US3] Integrate client obligation edit dialog, source/sync badge and inactivation confirmation into `src/components/obligations/ClientObligationsPanel.tsx`
- [ ] T074 [US3] Ensure generate competencies ignores inactive client-specific profiles while preserving historical instances in `supabase/functions/grow-obligations-module/index.ts`
- [ ] T075 [US3] Update client obligations quickstart notes for individual exceptions and history preservation in `docs/obligations/obligation-regime-loads.md`

**Checkpoint**: User Story 3 works independently for client-level exceptions.

---

## Phase 6: User Story 4 - Prevenir e corrigir duplicidades (Priority: P2)

**Goal**: Managers are warned or blocked before creating duplicate master obligations or duplicate client links, with a review path for historical duplicates.

**Independent Test**: Try to create `FGTS`, `F.G.T.S.` and `FGTS mensal` variants and confirm the system blocks or flags duplicate candidates and reuses the existing master obligation.

### Tests for User Story 4

- [ ] T076 [P] [US4] Add unit tests for semantic duplicate candidates and normalized names in `tests/unit/obligations/obligationDuplicateDiagnostics.test.ts`
- [ ] T077 [P] [US4] Add integration tests for `detect_obligation_duplicates` and server-side `upsert_template` duplicate blocking in `tests/integration/obligations/detectObligationDuplicates.test.ts`
- [ ] T078 [P] [US4] Add integration tests proving `apply_regime_load` and `sync_regime_load_existing_clients` reuse existing client profiles instead of creating duplicates in `tests/integration/obligations/regimeLoadDeduplication.test.ts`
- [ ] T079 [P] [US4] Add Playwright scenario for duplicate warning in the master obligation form in `tests/e2e/obligations/obligation-duplicate-warning.spec.ts`

### Implementation for User Story 4

- [X] T080 [US4] Implement backend `detect_obligation_duplicates` action in `supabase/functions/grow-obligations-module/index.ts`
- [ ] T081 [US4] Harden backend `upsert_template` to enforce normalized code/name duplicate rules in `supabase/functions/grow-obligations-module/index.ts`
- [ ] T082 [US4] Add duplicate candidate status updates and audit events for catalog review decisions in `supabase/functions/grow-obligations-module/index.ts`
- [ ] T083 [US4] Add frontend duplicate detection hook with debounced query behavior in `src/hooks/obligations/useObligationDuplicateDiagnostics.ts`
- [ ] T084 [US4] Show duplicate warnings and reuse-existing guidance in the obligation template dialog in `src/components/obligations/GrowObligationsWorkspace.tsx`
- [ ] T085 [US4] Create duplicate review panel for historical duplicate candidates in `src/components/obligations/regime-loads/ObligationDuplicateReviewPanel.tsx`
- [ ] T086 [US4] Integrate duplicate review filter and panel into the catalog tab in `src/components/obligations/GrowObligationsWorkspace.tsx`
- [ ] T087 [US4] Document duplicate prevention and manual review process in `docs/obligations/obligation-regime-loads.md`

**Checkpoint**: User Story 4 works independently for duplicate prevention and review.

---

## Phase 7: User Story 5 - Reaplicar carga em mudanca de regime (Priority: P2)

**Goal**: Users changing a company's tax regime can preview add/keep/reactivate/inactivate decisions and apply only confirmed changes.

**Independent Test**: Change a client from Simples Nacional to Lucro Presumido, preview the new load, confirm selected changes and verify shared obligations are kept without duplicates and generated history remains available.

### Tests for User Story 5

- [ ] T088 [P] [US5] Add integration tests for `preview_apply_regime_load` add/keep/reactivate/suggest-inactivate decisions in `tests/integration/obligations/previewRegimeMigration.test.ts`
- [ ] T089 [P] [US5] Add integration tests for `apply_regime_load` requiring confirmation for inactivation and duplicate-risk reviews in `tests/integration/obligations/applyRegimeMigration.test.ts`
- [ ] T090 [P] [US5] Add integration tests for branch inherited-regime migration review in `tests/integration/obligations/branchRegimeMigrationReview.test.ts`
- [ ] T091 [P] [US5] Add Playwright scenario for client detail regime change preview and apply flow in `tests/e2e/obligations/client-regime-migration.spec.ts`

### Implementation for User Story 5

- [ ] T092 [US5] Implement backend `preview_apply_regime_load` action for existing clients, branch inherited-regime review and regime migration in `supabase/functions/grow-obligations-module/index.ts`
- [ ] T093 [US5] Implement backend application of confirmed preview decisions in `apply_regime_load` for `regime_migration` and `reconcile_existing` modes without mutating generated history in `supabase/functions/grow-obligations-module/index.ts`
- [ ] T094 [US5] Add backend audit event writes for previewed, cancelled, failed and applied migration batches in `supabase/functions/grow-obligations-module/index.ts`
- [ ] T095 [US5] Create regime migration preview hook and mutation helpers in `src/hooks/obligations/useRegimeMigration.ts`
- [ ] T096 [P] [US5] Create migration summary component with add/keep/reactivate/inactivate/duplicate-risk and branch-review counts in `src/components/obligations/regime-loads/RegimeMigrationSummary.tsx`
- [ ] T097 [P] [US5] Create migration confirmation dialog for destructive or review-required decisions in `src/components/obligations/regime-loads/RegimeMigrationConfirmDialog.tsx`
- [ ] T098 [US5] Integrate regime change preview and confirmation flow into `src/pages/ClientDetailPage.tsx`
- [ ] T099 [US5] Ensure client data category save for `regime_tributario` triggers preview instead of silent load application in `src/pages/ClientDetailPage.tsx`
- [ ] T100 [US5] Document regime migration validation, branch review and rollback behavior in `docs/obligations/obligation-regime-loads-rollout.md`

**Checkpoint**: User Story 5 works independently for controlled regime migration.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final documentation, security review, performance review and validation across all stories.

- [ ] T101 [P] Update manual/help content for obligation regime loads in `src/lib/manual/content.ts`
- [ ] T102 [P] Add release notes for obligation regime loads in `docs/obligations/obligation-regime-loads-release-notes.md`
- [ ] T103 Run accessibility and responsive UX review for catalog, sync and client obligation controls and record findings in `docs/obligations/obligation-regime-loads-validation.md`
- [ ] T104 Run tenant isolation review for new tables, RLS, Edge Function actions, sync runs and client portal boundaries in `docs/obligations/obligation-regime-loads-tenant-review.md`
- [ ] T105 Run security review for duplicate prevention, conditional applicability, load application, automatic sync, audit metadata and controlled failure modes in `docs/obligations/obligation-regime-loads-security-review.md`
- [ ] T106 Run performance review for catalog loading, duplicate diagnostics, single-client load application and existing-client sync thresholds in `docs/obligations/obligation-regime-loads-performance.md`
- [ ] T107 Run quickstart scenarios and record outcomes in `docs/obligations/obligation-regime-loads-validation.md`
- [X] T108 Run `npm run lint` and record result in `docs/obligations/obligation-regime-loads-validation.md`
- [ ] T109 Run `npm run test` and record result in `docs/obligations/obligation-regime-loads-validation.md`
- [X] T110 Run `npm run build` and record result in `docs/obligations/obligation-regime-loads-validation.md`
- [ ] T111 Run `npm run verify:deploy` when environment variables are available and record result in `docs/obligations/obligation-regime-loads-validation.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup completion and blocks all user stories.
- **US1 (Phase 3)**: Depends on Foundation; recommended MVP.
- **US2 (Phase 4)**: Depends on Foundation and can run alongside US1 after shared schema/actions exist, but publishing sync benefits from US1 planner helpers.
- **US3 (Phase 5)**: Depends on Foundation and client profile source/sync fields; can run after or alongside US1.
- **US4 (Phase 6)**: Depends on Foundation; should land before enabling broad catalog editing and sync.
- **US5 (Phase 7)**: Depends on Foundation and benefits from US1/US3 source metadata.
- **Polish (Phase 8)**: Depends on completed target stories.

### User Story Dependencies

- **User Story 1 (P1)**: MVP and can start after Foundation.
- **User Story 2 (P1)**: Can start after Foundation; independent test is catalog/load management plus sync summary.
- **User Story 3 (P1)**: Can start after Foundation; independent test is client-specific exception handling.
- **User Story 4 (P2)**: Can start after Foundation; strengthens US1/US2 duplicate guarantees.
- **User Story 5 (P2)**: Should run after source metadata and preview model are available.

### Within Each User Story

- Tests first, then backend service/action work, then frontend integration, then documentation.
- Backend validation must land before UI relies on it.
- Migrations and type updates must land before hooks/components use new fields.
- Sync actions must prove they do not mutate generated competencies, tasks, calendar events, documents or protocols.

### Parallel Opportunities

- Setup stubs T002-T007 can run in parallel.
- Foundational helper/test tasks T009-T016 and T024-T025 can run in parallel after T008.
- Story test tasks in each user story can run in parallel.
- UI component tasks touching different files can run in parallel after backend contracts are stable.
- Documentation review tasks in Phase 8 can run in parallel.

---

## Parallel Example: User Story 2

```text
Task: "Add integration tests for list_regime_loads in tests/integration/obligations/listRegimeLoads.test.ts"
Task: "Add integration tests for syncRegimeLoadExistingClients in tests/integration/obligations/syncRegimeLoadExistingClients.test.ts"
Task: "Create regime load selector component in src/components/obligations/regime-loads/RegimeLoadSelector.tsx"
Task: "Create sync summary panel in src/components/obligations/regime-loads/RegimeLoadSyncSummary.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 setup.
2. Complete Phase 2 foundation, including migration, types, baseline seed, conditional evaluator and backend contracts.
3. Complete Phase 3 to auto-apply links for new clients without generating competencies.
4. Validate by creating clients for Simples Nacional, Lucro Presumido, Lucro Real and MEI.

### Incremental Delivery

1. Deliver automatic new-client link application with conditional review.
2. Deliver catalog/load management and existing-client active/future sync.
3. Deliver client-specific exceptions.
4. Deliver duplicate diagnostics and review.
5. Deliver controlled regime migration.
6. Run cross-cutting security, tenant, performance and quickstart validation.

### Safety Notes

- Do not reactivate Acessorias/e-continuo as the primary obligation flow.
- Do not put deduplication, conditional applicability, load application or sync only in React state.
- Do not generate competencies during new-client load application.
- Do not alter historical obligation instances, tasks, calendar events, documents or protocols during load sync.
- Preserve existing unrelated changes in `src/components/obligations/GrowObligationsWorkspace.tsx` while editing.
