# Tasks: Default Obligations by Tax Regime

**Input**: Design documents from `/specs/007-default-obligations/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included because the implementation plan defines Vitest, integration, and smoke coverage, and each user story has independent acceptance criteria.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files or depends only on completed earlier phases
- **[Story]**: User story label for traceability
- Every task includes exact file paths

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Inspect the existing obligations implementation and identify reusable integration points before changing behavior.

- [X] T001 Review current fiscal obligation baseline migration and deleted/inactivated defaults in `supabase/migrations/20260709193000_refresh_fiscal_obligation_baseline.sql`
- [X] T002 Review existing regime-load definitions and generic matrix helpers in `src/lib/obligations/baselineRegimeLoads.ts`
- [X] T003 Review existing conditional evidence helpers and condition keys in `src/lib/obligations/conditionalApplicability.ts`
- [X] T004 Review company registration and tax-regime persistence flow in `src/pages/ClientsPage.tsx`
- [X] T005 Review client creation backend flow and portal side effects in `supabase/functions/create-client-with-portal/index.ts`
- [X] T006 Review obligation module actions, authorization, audit, and application-batch patterns in `supabase/functions/grow-obligations-module/index.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish shared catalog, condition, contract, migration, and safety primitives used by all user stories.

**Critical**: No user story work should begin until this phase is complete.

- [X] T007 Update the generic default obligation matrix and exclude sector-specific defaults in `src/lib/obligations/baselineRegimeLoads.ts`
- [X] T008 [P] Add unit coverage for the generic matrix and sector-specific exclusions in `tests/unit/obligations/baselineRegimeLoads.test.ts`
- [X] T009 Update conditional applicability keys and positive-evidence evaluation rules in `src/lib/obligations/conditionalApplicability.ts`
- [X] T010 [P] Add unit coverage for missing evidence, positive evidence, skipped conditionals, and later automatic application eligibility in `tests/unit/obligations/conditionalApplicability.test.ts`
- [X] T011 Create idempotent migration for generic default templates, active regime-load memberships, tenant indexes, and rollback notes in `supabase/migrations/20260710103000_default_obligation_regime_matrix.sql`
- [X] T012 Update generated Supabase type expectations after migration in `src/integrations/supabase/types.ts`
- [X] T013 Define shared TypeScript contracts for default application summaries, skipped items, duplicate risks, and source labels in `src/lib/obligations/regimeLoadContracts.ts`
- [X] T014 Define shared backend helpers for default application summaries, skipped item rows, duplicate-risk rows, and controlled warnings in `supabase/functions/grow-obligations-module/index.ts`
- [X] T015 [P] Add integration contract coverage for default-application response shape and duplicate prevention in `tests/integration/obligations/defaultObligationContracts.test.ts`
- [X] T016 Verify default obligation definitions are visible but not editable through catalog UI affordances in `src/components/obligations/GrowObligationsWorkspace.tsx`

**Checkpoint**: Foundation ready. Generic default sets are defined, testable, tenant-safe, and available to backend actions.

---

## Phase 3: User Story 1 - Apply default obligations on company registration (Priority: P1) MVP

**Goal**: Newly registered companies with MEI, Simples Nacional, Lucro Presumido, or Lucro Real receive the correct generic default obligations automatically, while conditionals without positive evidence are skipped.

**Independent Test**: Register one active company for each supported tax regime and verify that only that regime's default obligations are assigned, conditionals require positive evidence, skipped conditionals are recorded, and duplicates are not created.

### Tests for User Story 1

- [X] T017 [P] [US1] Add integration test for applying MEI defaults during company registration in `tests/integration/obligations/defaultObligationContracts.test.ts`
- [X] T018 [P] [US1] Add integration test for applying Simples Nacional defaults during company registration in `tests/integration/obligations/defaultObligationContracts.test.ts`
- [X] T019 [P] [US1] Add integration test for applying Lucro Presumido defaults during company registration in `tests/integration/obligations/defaultObligationContracts.test.ts`
- [X] T020 [P] [US1] Add integration test for applying Lucro Real defaults during company registration in `tests/integration/obligations/defaultObligationContracts.test.ts`
- [X] T021 [P] [US1] Add integration test for skipping conditionals without positive evidence and returning skipped item summaries in `tests/integration/obligations/defaultObligationContracts.test.ts`
- [X] T022 [P] [US1] Add e2e or smoke coverage for new-client default obligations in `tests/e2e/internal-authenticated.spec.ts`

### Implementation for User Story 1

- [X] T023 [US1] Implement `apply_default_obligations` backend action with organization, role, client, regime, and evidence validation in `supabase/functions/grow-obligations-module/index.ts`
- [X] T024 [US1] Implement default-load lookup, required item application, conditional skip handling, and duplicate-safe profile upsert in `supabase/functions/grow-obligations-module/index.ts`
- [X] T025 [US1] Record application batches, skipped item decisions, duplicate-risk rows, and audit events for new-client default application in `supabase/functions/grow-obligations-module/index.ts`
- [X] T026 [US1] Wire client registration completion to request default obligations after successful client creation in `supabase/functions/create-client-with-portal/index.ts`
- [X] T027 [US1] Return controlled warnings for missing/unsupported regimes or missing active default loads in `supabase/functions/create-client-with-portal/index.ts`
- [X] T028 [US1] Add UI feedback for default assignment success, conditional skips, duplicate-risk warnings, and failure states in `src/pages/ClientsPage.tsx`
- [X] T029 [US1] Display source tags, skipped conditional information, and auto-apply messaging in client obligations view in `src/components/obligations/ClientObligationsPanel.tsx`
- [X] T030 [US1] Update frontend obligation types for application summaries, skipped items, duplicate-risk rows, and source labels in `src/lib/growObligations.ts`
- [X] T031 [US1] Ensure registration default assignment does not generate competencies, tasks, calendar events, documents, or protocols in `supabase/functions/grow-obligations-module/index.ts`
- [X] T032 [US1] Implement automatic conditional-default re-evaluation after relevant company evidence updates in `supabase/functions/grow-obligations-module/index.ts`
- [X] T033 [US1] Wire company attribute update flow to invoke conditional-default re-evaluation when relevant evidence fields change in `src/pages/ClientDetailPage.tsx`

**Checkpoint**: User Story 1 works independently as MVP.

---

## Phase 4: User Story 2 - Keep manual obligations available (Priority: P2)

**Goal**: Users can create additional manual obligations and link them to selected companies without changing default regime sets or system default definitions.

**Independent Test**: Create a manual obligation for a company that already has defaults and verify it is added as manual without removing, duplicating, or modifying defaults.

### Tests for User Story 2

- [X] T034 [P] [US2] Add unit test for manual obligation source preservation and no default-load mutation in `tests/unit/obligations/baselineRegimeLoads.test.ts`
- [X] T035 [P] [US2] Add integration test for manual obligation creation and selected-client linking in `tests/integration/obligations/defaultObligationContracts.test.ts`
- [X] T036 [P] [US2] Add e2e or smoke coverage for manual obligation creation from the manual obligation flow in `tests/e2e/internal-authenticated.spec.ts`

### Implementation for User Story 2

- [X] T037 [US2] Ensure manual obligation creation uses `source_kind = manual` and does not mutate regime-load items in `supabase/functions/grow-obligations-module/index.ts`
- [X] T038 [US2] Strengthen duplicate detection for manual obligations against active defaults and active manual obligations in `src/lib/obligations/obligationDeduplication.ts`
- [X] T039 [US2] Enforce backend duplicate blocking or duplicate-risk warnings for manual obligation saves in `supabase/functions/grow-obligations-module/index.ts`
- [X] T040 [US2] Preserve selected-company linking behavior for manual obligations in `src/components/obligations/GrowObligationsWorkspace.tsx`
- [X] T041 [US2] Remove or disable create/edit/delete/reclassify affordances for system default definitions in `src/components/obligations/GrowObligationsWorkspace.tsx`
- [X] T042 [US2] Show default versus manual source badges and duplicate warnings in `src/components/obligations/GrowObligationsWorkspace.tsx`
- [X] T043 [US2] Add audit metadata for manual obligation creation and linking in `supabase/functions/grow-obligations-module/index.ts`

**Checkpoint**: User Story 2 works independently and does not alter default sets.

---

## Phase 5: User Story 3 - Update defaults when tax regime changes (Priority: P3)

**Goal**: Changing a company's tax regime automatically aligns future default obligations with the new regime while preserving completed historical obligations.

**Independent Test**: Change a company from Simples Nacional to Lucro Presumido and verify future Simples Nacional defaults are inactivated, Lucro Presumido defaults are applied, shared obligations are not duplicated, and completed history remains available.

### Tests for User Story 3

- [X] T044 [P] [US3] Add integration test for automatic regime-change default additions, keeps, and prior-regime future inactivations in `tests/integration/obligations/defaultObligationContracts.test.ts`
- [X] T045 [P] [US3] Add integration test for automatic regime-change default application without duplicating shared obligations in `tests/integration/obligations/defaultObligationContracts.test.ts`
- [X] T046 [P] [US3] Add regression test that completed historical obligations survive automatic regime-change application in `tests/integration/obligations/defaultObligationContracts.test.ts`

### Implementation for User Story 3

- [X] T047 [US3] Implement `apply_regime_change_default_obligations` backend action with organization, role, client, and regime transition validation in `supabase/functions/grow-obligations-module/index.ts`
- [X] T048 [US3] Implement automatic prior-regime future inactivation and new-regime future default application in `supabase/functions/grow-obligations-module/index.ts`
- [X] T049 [US3] Preserve completed historical profiles, instances, documents, protocols, tasks, and calendar records during regime-change application in `supabase/functions/grow-obligations-module/index.ts`
- [X] T050 [US3] Wire client tax-regime edit flow to invoke automatic regime-change default application after save in `src/pages/ClientDetailPage.tsx`
- [X] T051 [US3] Add automatic regime-change summary UI for added, kept, auto-inactivated, skipped, duplicate-risk, and blocked items in `src/pages/ClientDetailPage.tsx`
- [X] T052 [US3] Add client obligation decision-state display for add, keep, auto-inactivate, duplicate-risk, blocked, and skipped decisions in `src/components/obligations/ClientObligationsPanel.tsx`
- [X] T053 [US3] Add audit events for automatic regime-change application in `supabase/functions/grow-obligations-module/index.ts`

**Checkpoint**: All user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate rollout, security, tenant isolation, performance, documentation, and deployment readiness.

- [X] T054 [P] Update obligation rollout documentation for generic defaults, conditional skips, automatic evidence application, and manual add-ons in `docs/obligations/obligation-regime-loads-rollout.md`
- [X] T055 [P] Update fiscal baseline documentation to match the final generic matrix in `docs/obligations/fiscal-obligation-baseline-2026.md`
- [X] T056 Run tenant isolation review for default application and manual obligations in `docs/obligations/obligation-regime-loads-tenant-review.md`
- [X] T057 Run security review for backend-owned default application, role boundaries, and no-UI default editing in `docs/obligations/obligation-regime-loads-security-review.md`
- [X] T058 Run performance review for registration default assignment and catalog/client obligation list filtering in `docs/obligations/obligation-regime-loads-performance.md`
- [X] T059 Run quickstart validation scenarios and record results in `docs/obligations/obligation-regime-loads-validation.md`
- [X] T060 Run `npm run lint` and record any blockers in `package.json`
- [X] T061 Run `npm run test` and record any blockers in `package.json`
- [X] T062 Run `npm run build` and record any blockers in `package.json`
- [X] T063 Run `npm run verify:deploy` and record any blockers in `package.json`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: No dependencies.
- **Phase 2 Foundational**: Depends on Phase 1 and blocks all user stories.
- **Phase 3 US1**: Depends on Phase 2 and is MVP.
- **Phase 4 US2**: Depends on Phase 2; can be built after or alongside US1 once shared backend contracts are stable.
- **Phase 5 US3**: Depends on Phase 2 and benefits from US1 behavior but remains independently testable through the backend automatic regime-change action.
- **Phase 6 Polish**: Depends on completed desired user stories.

### User Story Dependencies

- **US1 Apply default obligations on company registration**: MVP and primary delivery path.
- **US2 Keep manual obligations available**: Independent after foundation; validates manual additions do not mutate defaults.
- **US3 Update defaults when tax regime changes**: Independent backend flow after foundation; uses the same default application primitives.

### Parallel Opportunities

- T001-T006 can be split among reviewers.
- T008, T010, and T015 can be prepared while T007, T009, and T014 are implemented.
- T017-T022 can be written in parallel.
- T034-T036 can be written in parallel.
- T044-T046 can be written in parallel.
- Documentation tasks T054-T058 can be performed in parallel after implementation stabilizes.

---

## Parallel Example: User Story 1

```text
Task: "T017 [P] [US1] Add integration test for applying MEI defaults during company registration in tests/integration/obligations/defaultObligationContracts.test.ts"
Task: "T018 [P] [US1] Add integration test for applying Simples Nacional defaults during company registration in tests/integration/obligations/defaultObligationContracts.test.ts"
Task: "T019 [P] [US1] Add integration test for applying Lucro Presumido defaults during company registration in tests/integration/obligations/defaultObligationContracts.test.ts"
Task: "T020 [P] [US1] Add integration test for applying Lucro Real defaults during company registration in tests/integration/obligations/defaultObligationContracts.test.ts"
```

## Parallel Example: User Story 2

```text
Task: "T034 [P] [US2] Add unit test for manual obligation source preservation and no default-load mutation in tests/unit/obligations/baselineRegimeLoads.test.ts"
Task: "T035 [P] [US2] Add integration test for manual obligation creation and selected-client linking in tests/integration/obligations/defaultObligationContracts.test.ts"
Task: "T036 [P] [US2] Add e2e or smoke coverage for manual obligation creation from the manual obligation flow in tests/e2e/internal-authenticated.spec.ts"
```

## Parallel Example: User Story 3

```text
Task: "T044 [P] [US3] Add integration test for automatic regime-change default additions, keeps, and prior-regime future inactivations in tests/integration/obligations/defaultObligationContracts.test.ts"
Task: "T045 [P] [US3] Add integration test for automatic regime-change default application without duplicating shared obligations in tests/integration/obligations/defaultObligationContracts.test.ts"
Task: "T046 [P] [US3] Add regression test that completed historical obligations survive automatic regime-change application in tests/integration/obligations/defaultObligationContracts.test.ts"
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 only.
3. Validate that new company registration assigns defaults correctly by regime.
4. Stop and demo before manual-add-on and regime-change work.

### Incremental Delivery

1. Deliver US1 automatic defaults on registration and evidence updates.
2. Deliver US2 manual obligation add-ons with source clarity and no default editing UI.
3. Deliver US3 automatic regime-change application.
4. Finish cross-cutting validation and deployment checks.

### Safety Rules

- Do not generate competencies during company registration default assignment.
- Do not delete completed history during regime changes.
- Do not apply conditional obligations without positive evidence.
- Do not expose create/edit/delete/reclassify actions for system default definitions in the UI.
- Do not let frontend-only logic decide default membership, duplicates, role authorization, or tenant scope.
