# Tasks: Obligation Delivery Flow

**Input**: Design documents from `/specs/005-obligation-delivery-flow/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included because the feature changes sensitive completion, delivery, retry, and audit behavior.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4, US5)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm current implementation surface and prepare targeted test scaffolding.

- [X] T001 Inspect existing obligation delivery tables, constraints, and status values in supabase/migrations/20260505103000_add_grow_obligations_native_module.sql
- [X] T002 Inspect existing document robot and ingestion tables in supabase/migrations/20260513122543_add_grow_document_robot_pipeline.sql
- [X] T003 Inspect existing completion email fields and behavior in supabase/migrations/20260511233212_add_completion_email_fields_to_obligation_templates.sql
- [X] T004 [P] Inspect current backend actions and status transitions in supabase/functions/grow-obligations-module/index.ts
- [X] T005 [P] Inspect current automatic document processor completion behavior in supabase/functions/obligation-document-processor/index.ts
- [X] T006 [P] Inspect current obligation workspace mutations and queue UI in src/components/obligations/GrowObligationsWorkspace.tsx
- [X] T007 [P] Create test fixture outline for obligation delivery scenarios in src/test/obligationDeliveryFlow.test.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add durable state, shared rules, and backend contracts required by all user stories.

**CRITICAL**: No user story work can be complete until this phase is complete.

- [X] T008 Create additive migration for delivery attempt state, status values, indexes, and rollback notes in supabase/migrations/<timestamp>_add_obligation_delivery_attempts.sql
- [X] T009 Add organization/client scoped RLS policies for obligation delivery attempt records in supabase/migrations/<timestamp>_add_obligation_delivery_attempts.sql
- [X] T010 Add reconciliation SQL that preserves historical completed instances without successful email evidence and marks them for delivery review/audit in supabase/migrations/<timestamp>_add_obligation_delivery_attempts.sql
- [X] T011 Add backend helper types for delivery attempts, delivery preparation, and retry state in supabase/functions/grow-obligations-module/index.ts
- [X] T012 Add backend helpers to resolve organization, client, template, instance, inbox item, and sendable files for delivery in supabase/functions/grow-obligations-module/index.ts
- [X] T013 Add backend helper to resolve verified Grow `From` address plus authenticated user's reply-to/audit email in supabase/functions/grow-obligations-module/index.ts
- [X] T014 Add backend helper to default recipient to the client's primary email, accept reviewed recipient override, and validate required document completeness in supabase/functions/grow-obligations-module/index.ts
- [X] T015 Add backend helper to create sanitized obligation instance events for delivery attempt lifecycle in supabase/functions/grow-obligations-module/index.ts
- [X] T016 Add shared frontend types for delivery preparation, attempt status, and retry responses in src/lib/obligations/regimeLoadTypes.ts
- [X] T017 Add Vitest coverage for delivery status helpers, human confirmation guard, recipient defaulting, and duplicate-send guard helpers in src/test/obligationDeliveryFlow.test.ts
- [X] T018 Add SQL test skeleton for completion boundary, delivery review flags, and delivery attempt RLS in supabase/tests/obligation_delivery_flow.sql

**Checkpoint**: Foundation ready - user story implementation can now begin.

---

## Phase 3: User Story 1 - Configure Obligation For Delivery (Priority: P1) MVP

**Goal**: Existing obligation catalog can configure expected documents, extraction templates, and default email messages without treating templates as client attachments.

**Independent Test**: Create or edit an obligation with expected documents, reference files, and email message fields, then confirm it can generate future operational work and never marks reference templates as sendable guides.

### Tests for User Story 1

- [X] T019 [P] [US1] Add validation tests for expected document uniqueness and email template requirements in src/test/obligationDeliveryFlow.test.ts
- [X] T020 [P] [US1] Add SQL validation cases for active template configuration in supabase/tests/obligation_delivery_flow.sql

### Implementation for User Story 1

- [X] T021 [US1] Harden `upsert_template` validation for expected documents, email subject/body, and active required docs in supabase/functions/grow-obligations-module/index.ts
- [X] T022 [US1] Ensure `upload_reference_document` stores reference files only as extraction templates and never marks them as sendable delivery attachments in supabase/functions/grow-obligations-module/index.ts
- [X] T023 [US1] Update catalog form messaging and disabled states for email/template requirements in src/components/obligations/GrowObligationsWorkspace.tsx
- [X] T024 [US1] Add UI distinction between reference templates and sendable guide files in src/components/obligations/GrowObligationsWorkspace.tsx
- [X] T025 [US1] Add query invalidation after template/reference changes so catalog and document options remain synchronized in src/components/obligations/GrowObligationsWorkspace.tsx

**Checkpoint**: US1 is testable independently through catalog creation/editing and reference document attachment.

---

## Phase 4: User Story 2 - Generate Operational Tasks Automatically (Priority: P2)

**Goal**: Existing obligation generation creates exactly one operational instance/task per client, obligation, and competence, and keeps work open until delivery succeeds.

**Independent Test**: Activate an obligation for a client and competence, generate instances twice, and confirm one open task/instance exists and remains open before email delivery.

### Tests for User Story 2

- [X] T026 [P] [US2] Add SQL test for idempotent obligation instance generation in supabase/tests/obligation_delivery_flow.sql
- [X] T027 [P] [US2] Add SQL test for Kanban task idempotency and non-completion before delivery success in supabase/tests/obligation_delivery_flow.sql

### Implementation for User Story 2

- [X] T028 [US2] Ensure `generate_instances` uses organization/client/template/competence idempotency in supabase/functions/grow-obligations-module/index.ts
- [X] T029 [US2] Ensure generated Kanban task integration keys map one-to-one to obligation instances in supabase/functions/grow-obligations-module/index.ts
- [X] T030 [US2] Prevent direct update paths from closing delivery-required instances before explicit human confirmation and successful delivery attempt exist in supabase/functions/grow-obligations-module/index.ts
- [X] T031 [US2] Add task status synchronization so successful delivery closes the related Kanban task in supabase/functions/grow-obligations-module/index.ts
- [X] T032 [US2] Update client obligation panel generation feedback for duplicate-safe generation in src/components/obligations/ClientObligationsPanel.tsx
- [X] T033 [US2] Update workspace generation summary and error handling for idempotent generation in src/components/obligations/GrowObligationsWorkspace.tsx

**Checkpoint**: US2 is testable independently through repeated generation and task state inspection.

---

## Phase 5: User Story 3 - Upload Guides In Central Documents (Priority: P3)

**Goal**: Central de Documentos and the robot pipeline reliably route uploaded guides to client, obligation, competence, and expected document without sending emails automatically.

**Independent Test**: Upload a valid guide and confirm it links to the correct pending delivery; upload an ambiguous guide and confirm it enters manual review without email or completion.

### Tests for User Story 3

- [X] T034 [P] [US3] Add Vitest coverage for local document match preview decisions in src/test/obligationDeliveryFlow.test.ts
- [X] T035 [P] [US3] Add SQL test for inbox item states `pending_review`, `linked`, and `rejected` in supabase/tests/obligation_delivery_flow.sql

### Implementation for User Story 3

- [X] T036 [US3] Harden `register_document_upload` to reuse ingestion jobs by storage path/hash and preserve existing records in supabase/functions/grow-obligations-module/index.ts
- [X] T037 [US3] Harden `register_robot_document_upload` to validate organization, client, template, instance, and storage ownership in supabase/functions/grow-obligations-module/index.ts
- [X] T038 [US3] Ensure `preview_document_match` never mutates state, sends email, requests human confirmation, or completes an instance in supabase/functions/grow-obligations-module/index.ts
- [X] T039 [US3] Update matching rules so low-confidence or conflicting files enter manual review in supabase/functions/grow-obligations-module/index.ts
- [X] T040 [US3] Update `resolve_document` so accepting a match attaches the guide and prepares delivery state without completing on email-required obligations in supabase/functions/grow-obligations-module/index.ts
- [X] T041 [US3] Update `obligation-document-processor` so linked documents move to ready/retryable states and never auto-send or mark instances complete before human-confirmed email success in supabase/functions/obligation-document-processor/index.ts
- [X] T042 [US3] Improve Central de Documentos batch upload per-file statuses, retry messages, and manual review affordances in src/components/obligations/GrowObligationsWorkspace.tsx
- [X] T043 [US3] Add server-backed filters for document status, client, obligation, competence, and sender in src/components/obligations/GrowObligationsWorkspace.tsx

**Checkpoint**: US3 is testable independently through web upload, robot upload, match preview, and manual review.

---

## Phase 6: User Story 4 - Send Guide To Client And Close Task (Priority: P4)

**Goal**: The matched guide is emailed to the reviewed recipient with the obligation message, verified Grow sender, user reply-to/audit identity, and only human-confirmed successful email delivery completes the instance/task.

**Independent Test**: Upload and link a guide, prepare delivery, confirm the primary client email is defaulted, send it as an authenticated user, then verify the client email attempt is sent from a verified Grow sender with user reply-to/audit identity, instance is complete, and task is closed; missing confirmation or provider failure must keep work open.

### Tests for User Story 4

- [X] T044 [P] [US4] Add tests for missing user reply-to email, missing client recipient email, missing human confirmation, and missing attachment failures in src/test/obligationDeliveryFlow.test.ts
- [X] T045 [P] [US4] Add SQL test proving `concluida` requires human confirmation plus a successful delivery attempt in supabase/tests/obligation_delivery_flow.sql

### Implementation for User Story 4

- [X] T046 [US4] Implement `prepare_delivery` action with primary client recipient default, reviewed recipient support, verified Grow sender, user reply-to/audit identity, message, attachment, and warning payload in supabase/functions/grow-obligations-module/index.ts
- [X] T047 [US4] Implement `send_delivery` action with required human confirmation, verified Grow `From`, authenticated user reply-to/audit email, guide attachments, idempotency key, and provider result handling in supabase/functions/grow-obligations-module/index.ts
- [X] T048 [US4] Refactor existing completion email helper to create durable delivery attempts before and after provider calls in supabase/functions/grow-obligations-module/index.ts
- [X] T049 [US4] Refactor existing completion email helper to attach guide files to outgoing email payload instead of sending message-only completion notices in supabase/functions/grow-obligations-module/index.ts
- [X] T050 [US4] Update task/instance completion path to run only after `send_delivery` records human-confirmed status `sent` in supabase/functions/grow-obligations-module/index.ts
- [X] T051 [US4] Update `obligation-document-processor` to leave ready-to-send state consistently and never call provider delivery without human confirmation in supabase/functions/obligation-document-processor/index.ts
- [X] T052 [US4] Add send confirmation, primary recipient review/edit, prepared message preview, verified sender/reply-to display, attachment list, and failure state UI in src/components/obligations/GrowObligationsWorkspace.tsx
- [X] T053 [US4] Add TanStack Query mutations and invalidation for `prepare_delivery` and `send_delivery` in src/components/obligations/GrowObligationsWorkspace.tsx

**Checkpoint**: US4 is testable independently through successful email send, failed email send, and task completion inspection.

---

## Phase 7: User Story 5 - Audit And Reprocess Delivery Problems (Priority: P5)

**Goal**: Users can review failed/pending/sent deliveries, retry failed sends, inspect historical delivery review flags, and see a durable audit trail without losing historical attempts.

**Independent Test**: Force a match failure or email failure, correct or retry it, reconcile a historical completed record without email evidence, and verify the audit trail preserves original and corrected events while historical completion is not reopened.

### Tests for User Story 5

- [X] T054 [P] [US5] Add tests for retry preserving failed attempt history in src/test/obligationDeliveryFlow.test.ts
- [X] T055 [P] [US5] Add SQL test for duplicate successful delivery warning state and historical review flags in supabase/tests/obligation_delivery_flow.sql

### Implementation for User Story 5

- [X] T056 [US5] Implement `retry_delivery` action that revalidates verified sender, user reply-to/audit email, reviewed recipient, human confirmation, attachments, and current instance status in supabase/functions/grow-obligations-module/index.ts
- [X] T057 [US5] Implement `cancel_delivery` action that records reason without deleting source documents in supabase/functions/grow-obligations-module/index.ts
- [X] T058 [US5] Add duplicate successful delivery detection and explicit confirmation requirement in supabase/functions/grow-obligations-module/index.ts
- [X] T059 [US5] Add delivery attempt, historical review flag, and event data to `overview` response with pagination-safe fields in supabase/functions/grow-obligations-module/index.ts
- [X] T060 [US5] Add delivery history, historical review/audit flag, retry button, duplicate warning, and cancellation affordances in src/components/obligations/GrowObligationsWorkspace.tsx
- [X] T061 [US5] Add sanitized provider error display and audit metadata rendering in src/components/obligations/GrowObligationsWorkspace.tsx

**Checkpoint**: US5 is testable independently through failed delivery, retry, duplicate warning, and audit review.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Validation, performance, security review, and documentation.

- [X] T062 [P] Review React render paths for repeated scans and introduce page-level `Map`/`Set` derivations where needed in src/components/obligations/GrowObligationsWorkspace.tsx
- [X] T063 [P] Review route imports to ensure public routes do not import internal obligation workflow code in src/App.tsx
- [X] T064 [P] Update quickstart validation notes after implementation in specs/005-obligation-delivery-flow/quickstart.md
- [X] T065 Review service-role usage, human confirmation enforcement, recipient override validation, sensitive logging, and provider error sanitization in supabase/functions/grow-obligations-module/index.ts
- [X] T066 Review storage policy assumptions and signed URL scope for `obligation-files` in supabase/migrations/<timestamp>_add_obligation_delivery_attempts.sql
- [X] T067 Run SQL validation for obligation delivery flow using supabase/tests/obligation_delivery_flow.sql
- [X] T068 Run `npm run lint` using package.json
- [X] T069 Run `npm run test` using package.json
- [X] T070 Run `npm run build` using package.json
- [X] T071 Run `npm run verify:deploy` using package.json

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion - blocks all user stories.
- **US1 Configure Obligation (Phase 3)**: Depends on Foundational.
- **US2 Generate Tasks (Phase 4)**: Depends on Foundational; can run after or parallel to US1 if shared template validation is stable.
- **US3 Upload Guides (Phase 5)**: Depends on Foundational; benefits from US1 expected document validation.
- **US4 Send And Close (Phase 6)**: Depends on US1, US2, and US3 because it needs configured obligations, open tasks, and linked guide files.
- **US5 Audit And Reprocess (Phase 7)**: Depends on US4 delivery attempt state.
- **Polish (Phase 8)**: Depends on selected user stories being complete.

### User Story Dependencies

- **US1 (P1)**: MVP catalog configuration and reference/guide separation.
- **US2 (P2)**: Operational task generation and non-completion before delivery.
- **US3 (P3)**: Document upload, robot routing, and manual review.
- **US4 (P4)**: Human-confirmed client email delivery and completion boundary.
- **US5 (P5)**: Retry, duplicate handling, cancellation, historical review flags, and audit review.

### Parallel Opportunities

- T004, T005, T006, and T007 can run in parallel after T001-T003 begin.
- T011-T015 backend helper tasks can be split from T016-T018 type/test setup.
- US1 tests T019-T020 can run before implementation T021-T025.
- US2 tests T026-T027 can run before implementation T028-T033.
- US3 tests T034-T035 can run before implementation T036-T043.
- US4 tests T044-T045 can run before implementation T046-T053.
- US5 tests T054-T055 can run before implementation T056-T061.
- T062-T064 can run in parallel with final backend review after story implementation is complete.

---

## Parallel Example: User Story 3

```text
Task: "T034 [P] [US3] Add Vitest coverage for local document match preview decisions in src/test/obligationDeliveryFlow.test.ts"
Task: "T035 [P] [US3] Add SQL test for inbox item states `pending_review`, `linked`, and `rejected` in supabase/tests/obligation_delivery_flow.sql"
Task: "T042 [US3] Improve Central de Documentos batch upload per-file statuses, retry messages, and manual review affordances in src/components/obligations/GrowObligationsWorkspace.tsx"
```

## Parallel Example: User Story 4

```text
Task: "T044 [P] [US4] Add tests for missing user reply-to email, missing client recipient email, missing human confirmation, and missing attachment failures in src/test/obligationDeliveryFlow.test.ts"
Task: "T045 [P] [US4] Add SQL test proving `concluida` requires human confirmation plus a successful delivery attempt in supabase/tests/obligation_delivery_flow.sql"
Task: "T052 [US4] Add send confirmation, primary recipient review/edit, prepared message preview, verified sender/reply-to display, attachment list, and failure state UI in src/components/obligations/GrowObligationsWorkspace.tsx"
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2.
2. Complete US1 so obligations are configured correctly and reference templates are not confused with sendable guides.
3. Validate US1 independently.

### Operationally Useful Increment

1. Complete US1 and US2 to create valid obligation work and tasks.
2. Complete US3 to route guides into the right obligation/client/competence.
3. Stop and validate upload/review without sending.

### Full Delivery Increment

1. Complete US4 so human-confirmed email delivery is the completion boundary.
2. Complete US5 so failures, retries, duplicates, historical review flags, and audits are operationally visible.
3. Run Phase 8 validation and quickstart.

### Notes For Implementers

- Do not create a parallel obligations module.
- Do not let frontend-only checks decide completion, delivery success, or access.
- Do not mark `obligation_instances.status = 'concluida'` for email-required obligations until explicit human confirmation and a successful delivery attempt exist.
- Do not auto-send client emails from document processing, even for high-confidence matches.
- Do not reopen historical completed obligations solely because email evidence is missing; flag them for review/audit.
- Do not send reference/template files to clients.
- Preserve existing valid data and add reconciliation for records created by the old incomplete flow.
