# Tasks: Parametros Gerais de Seguranca

**Input**: Design documents from `/specs/001-security-parameters/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/security-baseline-contract.md, quickstart.md

**Tests**: TDD was not requested. This task list uses staged validation tasks, manual security scenarios, inventory scripts, and existing project quality gates.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each security increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4, US5)
- Every task includes exact file paths

## Phase 1: Setup (Repository Baseline Artifacts)

**Purpose**: Create the repository-owned baseline structure. The first delivery must be reviewable in Git under `docs/security/` and must not require new database tables or an admin UI.

- [X] T001 Create `docs/security/README.md` explaining that `docs/security/` is the first baseline source of truth and runtime hardening follows prioritized gaps
- [X] T002 Create `docs/security/security-control-matrix.md` using the Protected Surface Record fields from `specs/001-security-parameters/contracts/security-baseline-contract.md`
- [X] T003 Create `docs/security/security-validation-runbook.md` with sections for commands, manual scenarios, blocked validations, residual risks and evidence links
- [X] T004 [P] Create `docs/security/operational-security-settings.md` with environment rows for development, staging and production controls
- [X] T005 [P] Create `docs/security/security-risk-classification.md` defining critical/high/medium/low, including critical triggers for cross-tenant/cross-client exposure, service-role/secret validation gaps and private Storage exposure
- [X] T006 [P] Create `docs/security/security-baseline-sources.md` linking Supabase RLS, Data API, Storage access control, Auth sessions, Auth rate limits and redirect URL references from `specs/001-security-parameters/research.md`
- [X] T007 [P] Create `scripts/security/README.md` documenting local inventory scripts, expected outputs and evidence update workflow

---

## Phase 2: Foundational (Blocking Inventory And Evidence Model)

**Purpose**: Build the shared inventory tooling and evidence model that all user-story hardening depends on.

**CRITICAL**: No user story implementation should begin until this phase is complete.

- [X] T008 Create `scripts/security/inventory-routes.mjs` to inventory public, internal and portal routes from `src/App.tsx`
- [X] T009 Create `scripts/security/inventory-edge-functions.mjs` to inventory function names and `verify_jwt` settings from `supabase/config.toml`
- [X] T010 Create `scripts/security/inventory-storage-usage.mjs` to inventory Storage bucket names referenced under `src/` and `supabase/functions/`
- [X] T011 Create `scripts/security/inventory-supabase-access.mjs` to inventory Supabase table names and direct `.from(...)` calls under `src/` and `supabase/functions/`
- [X] T012 Create `scripts/security/build-security-control-matrix.mjs` to merge route, function, storage and table inventories into `docs/security/security-control-matrix.md`
- [X] T013 Update `package.json` with a `security:inventory` script that runs `scripts/security/build-security-control-matrix.mjs`
- [X] T014 [P] Create `docs/security/security-evidence-template.md` from `specs/001-security-parameters/contracts/security-baseline-contract.md`
- [X] T015 [P] Create `docs/security/security-review-schedule.md` documenting 60-day due dates for medium-risk items and 90-day due dates for low-risk items
- [X] T016 Update `docs/security/security-control-matrix.md` with required columns `review_owner`, `review_due_date`, `evidence_path` and `validation_status`
- [X] T017 Update `docs/security/security-control-matrix.md` with initial critical/high entries for portal, user management, private documents, public webhooks, AI, WhatsApp, Open Finance and Acessorias
- [X] T018 Validate Phase 2 by running `npm run security:inventory` and recording the command result in `docs/security/security-validation-runbook.md`

**Checkpoint**: Security inventory exists, critical/high surfaces have evidence paths, and medium/low surfaces have review scheduling rules.

---

## Phase 3: User Story 1 - Validar acesso seguro por papel, organizacao e cliente (Priority: P1) MVP

**Goal**: Ensure role, organization and client access rules are inventoried, documented and validated for protected internal and portal flows.

**Independent Test**: Attempt cross-client portal access, department-only admin action and out-of-organization access; expected result is no unauthorized data or state change. Any possible cross-tenant/cross-client path is critical until proven otherwise.

### Implementation for User Story 1

- [X] T019 [P] [US1] Document route-level access rules for public, internal and portal surfaces in `docs/security/security-control-matrix.md`
- [X] T020 [P] [US1] Document role capabilities for `admin`, `director`, `manager`, `employee`, `commercial`, `partner`, `departamento_pessoal`, `fiscal`, `contabil` and `client` in `docs/security/role-access-matrix.md`
- [X] T021 [P] [US1] Review role helpers from `src/lib/accessControl.ts` and record evidence in `docs/security/role-access-matrix.md`
- [X] T022 [US1] Review organization resolution in `src/hooks/useAuth.tsx` and record evidence in `docs/security/security-control-matrix.md`
- [X] T023 [US1] Review route enforcement in `src/components/app/ProtectedRoute.tsx` and record evidence in `docs/security/security-control-matrix.md`
- [X] T024 [US1] Review portal client access logic in `src/pages/PortalClientePage.tsx` and document `client_users` versus `portal_user_id` fallback in `docs/security/security-control-matrix.md`
- [X] T025 [US1] Review internal user-management functions in `supabase/functions/create-team-user/index.ts`, `supabase/functions/manage-team-user/index.ts` and `supabase/functions/create-admin/index.ts` and record validation evidence in `docs/security/security-control-matrix.md`
- [X] T026 [US1] Create `docs/security/manual-scenarios/access-control.md` with validation for cross-client portal access, department-only restrictions and organization switching
- [X] T027 [US1] Mark any possible cross-tenant or cross-client gap as critical in `docs/security/security-control-matrix.md` with evidence path and validation status
- [X] T028 [US1] Add required follow-up remediation items for role/tenant access to `docs/security/security-control-matrix.md` with owner layer `rls`, `edge_function` or `frontend`
- [ ] T029 [US1] Validate US1 by running `docs/security/manual-scenarios/access-control.md` scenarios in staging and recording pass/fail evidence in `docs/security/security-validation-runbook.md`

**Checkpoint**: US1 independently proves that role, organization and client boundaries are documented, risk-classified and testable.

---

## Phase 4: User Story 2 - Proteger documentos, storage e downloads sensiveis (Priority: P1)

**Goal**: Standardize private document handling, bucket classification, signed URL use, upload validation and document access audit requirements.

**Independent Test**: Upload valid/invalid files, attempt unauthorized private document access, reuse an expired signed URL and confirm audit evidence for sensitive uploads/downloads. Improperly accessible private Storage is critical until proven otherwise.

### Implementation for User Story 2

- [X] T030 [P] [US2] Create `docs/security/storage-policy-matrix.md` listing public and private buckets referenced by `src/` and `supabase/functions/`
- [X] T031 [P] [US2] Review upload validation helpers in `src/lib/fileUploadSecurity.ts` and document allowed MIME types, blocked extensions and size limits in `docs/security/storage-policy-matrix.md`
- [X] T032 [US2] Review client document upload/download flows in `src/pages/PortalClientePage.tsx` and record authorization evidence in `docs/security/storage-policy-matrix.md`
- [X] T033 [US2] Review internal client file flows in `src/pages/ClientDetailPage.tsx` and record authorization evidence in `docs/security/storage-policy-matrix.md`
- [X] T034 [US2] Review obligations document flows in `src/components/obligations/GrowObligationsWorkspace.tsx` and record authorization evidence in `docs/security/storage-policy-matrix.md`
- [X] T035 [US2] Review process/document legacy flows in `src/pages/ProcessosPage.tsx` and `src/pages/SugestoesPage.tsx` and mark legacy risk status in `docs/security/storage-policy-matrix.md`
- [X] T036 [US2] Review Storage usage in `supabase/functions/acessorias-module/index.ts` and `supabase/functions/grow-obligations-module/index.ts` and record service-role file access controls in `docs/security/storage-policy-matrix.md`
- [X] T037 [US2] Create `docs/security/manual-scenarios/storage-documents.md` with validation for unauthorized download, expired signed URL, invalid file type and audit evidence
- [X] T038 [US2] Mark improperly accessible private Storage findings as critical in `docs/security/security-control-matrix.md` with evidence path and validation status
- [X] T039 [US2] Add required Storage policy or bucket-setting remediation items to `docs/security/security-control-matrix.md`
- [ ] T040 [US2] Validate US2 by running `docs/security/manual-scenarios/storage-documents.md` scenarios in staging and recording pass/fail evidence in `docs/security/security-validation-runbook.md`

**Checkpoint**: US2 independently proves private document flows and Storage risks are documented, risk-classified and testable.

---

## Phase 5: User Story 3 - Executar acoes sensiveis somente em backend confiavel (Priority: P1)

**Goal**: Ensure service-role, secrets, privileged actions and external integrations are owned by Edge Functions or trusted backend code with explicit validation evidence.

**Independent Test**: Verify no secret is browser-visible, privileged functions reject missing/invalid authorization, and public webhooks validate provider-specific controls before changing state. Service-role or secret use without strong validation is critical until proven otherwise.

### Implementation for User Story 3

- [X] T041 [P] [US3] Create `docs/security/edge-function-security-matrix.md` from `supabase/config.toml` with function name, `verify_jwt`, public webhook status and owner module
- [X] T042 [P] [US3] Review frontend integration helpers in `src/lib/ai/growAssistant.ts`, `src/lib/growObligations.ts`, `src/lib/pushNotifications.ts`, `src/lib/newsletter.ts` and `src/lib/siteLeadCapture.ts` and record browser-callable function usage in `docs/security/edge-function-security-matrix.md`
- [X] T043 [US3] Review privileged user functions in `supabase/functions/create-team-user/index.ts`, `supabase/functions/manage-team-user/index.ts`, `supabase/functions/create-admin/index.ts` and `supabase/functions/reset-client-portal-passwords/index.ts` and record JWT, role, organization and payload validation evidence in `docs/security/edge-function-security-matrix.md`
- [X] T044 [US3] Review integration token handling in `supabase/functions/manage-integration-token/index.ts` and `src/pages/ConfiguracoesPage.tsx` and record secret-handling evidence in `docs/security/edge-function-security-matrix.md`
- [X] T045 [US3] Review AI and WhatsApp controls in `supabase/functions/grow-assistant/index.ts`, `supabase/functions/grow-assistant-confirm-action/index.ts`, `supabase/functions/whatsapp-webhook/index.ts` and `supabase/functions/_shared/ai/` and record risk-confirmation evidence in `docs/security/edge-function-security-matrix.md`
- [X] T046 [US3] Review Open Finance controls in `supabase/functions/open-finance-module/index.ts` and `supabase/functions/open-finance-webhook/index.ts` and record JWT/signature/idempotency evidence in `docs/security/edge-function-security-matrix.md`
- [X] T047 [US3] Review Acessorias controls in `supabase/functions/acessorias-module/index.ts` and record organization, role and service-role validation evidence in `docs/security/edge-function-security-matrix.md`
- [X] T048 [US3] Review e-mail, newsletter and push functions in `supabase/functions/send-site-contact-email/index.ts`, `supabase/functions/send-newsletter-broadcast/index.ts` and `supabase/functions/send-push-notification/index.ts` and record validation and rate-limit expectations in `docs/security/edge-function-security-matrix.md`
- [X] T049 [US3] Create `docs/security/manual-scenarios/edge-functions-webhooks.md` with missing JWT, invalid role, duplicate webhook and invalid signature scenarios
- [X] T050 [US3] Mark service-role or secret validation gaps as critical in `docs/security/security-control-matrix.md` with evidence path and validation status
- [X] T051 [US3] Add required Edge Function remediation items to `docs/security/security-control-matrix.md`
- [ ] T052 [US3] Validate US3 by running `docs/security/manual-scenarios/edge-functions-webhooks.md` scenarios in staging and recording pass/fail evidence in `docs/security/security-validation-runbook.md`

**Checkpoint**: US3 independently proves privileged actions and public webhook controls are documented, risk-classified and testable.

---

## Phase 6: User Story 4 - Auditar acoes criticas e suportar resposta a incidentes (Priority: P2)

**Goal**: Define and validate audit evidence for sensitive actions and controlled failure paths.

**Independent Test**: Execute representative permission, document, report and integration actions; verify logs identify actor, organization, client, entity, action, timestamp and result without leaking secrets.

### Implementation for User Story 4

- [X] T053 [P] [US4] Create `docs/security/audit-event-catalog.md` listing required audit events from FR-012 in `specs/001-security-parameters/spec.md`
- [X] T054 [P] [US4] Review `operational_audit_logs` usage in `supabase/functions/create-client-with-portal/index.ts`, `supabase/functions/manage-team-user/index.ts` and `supabase/functions/create-team-user/index.ts` and document current coverage in `docs/security/audit-event-catalog.md`
- [X] T055 [US4] Review AI audit tables and logs referenced under `supabase/functions/_shared/ai/` and document coverage in `docs/security/audit-event-catalog.md`
- [X] T056 [US4] Review WhatsApp logs in `supabase/functions/whatsapp-webhook/index.ts` and document coverage in `docs/security/audit-event-catalog.md`
- [X] T057 [US4] Review Open Finance webhook logs in `supabase/functions/open-finance-webhook/index.ts` and document coverage in `docs/security/audit-event-catalog.md`
- [X] T058 [US4] Review document upload/download audit gaps from `docs/security/storage-policy-matrix.md` and add remediation items to `docs/security/audit-event-catalog.md`
- [X] T059 [US4] Create `docs/security/incident-response-runbook.md` with steps for secret leak, unauthorized access, failed restore, suspicious login and webhook abuse
- [X] T060 [US4] Create `docs/security/manual-scenarios/audit-incident-response.md` with validation steps for permission change, document download, integration failure and secret-redaction checks
- [X] T061 [US4] Add required audit remediation items to `docs/security/security-control-matrix.md` with risk level, owner, due date and evidence path
- [ ] T062 [US4] Validate US4 by running `docs/security/manual-scenarios/audit-incident-response.md` scenarios in staging and recording pass/fail evidence in `docs/security/security-validation-runbook.md`

**Checkpoint**: US4 independently proves sensitive events have audit evidence or documented remediation.

---

## Phase 7: User Story 5 - Operar com ambientes, backups e revisao de acesso (Priority: P2)

**Goal**: Document and validate operational security controls for environments, Auth settings, deploy headers, backups, restore, secrets and access reviews.

**Independent Test**: Complete the operational checklist for development, staging and production without exposing production secrets or real data to lower environments.

### Implementation for User Story 5

- [X] T063 [P] [US5] Expand `docs/security/operational-security-settings.md` with required settings for separate databases, separate keys, production data use, backups, restore tests and PITR
- [X] T064 [P] [US5] Create `docs/security/auth-security-settings.md` with MFA, session lifetime, inactivity timeout, single-session, reauthentication, rate-limit and redirect URL requirements
- [X] T065 [P] [US5] Create `docs/security/deploy-security-headers.md` with target CSP, CORS, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` and `Permissions-Policy` requirements for Vercel, Netlify and GitHub Pages
- [X] T066 [US5] Review `vercel.json`, `netlify.toml` and `public/_redirects` and document current deploy header gaps in `docs/security/deploy-security-headers.md`
- [X] T067 [US5] Review `.env.example`, `README.md` and `docs/contexto-operacional-atual.md` and document secret-handling and environment separation updates in `docs/security/operational-security-settings.md`
- [X] T068 [US5] Create `docs/security/access-review-runbook.md` with Supabase dashboard, deploy platform, repository, secrets and third-party tool review cadence
- [X] T069 [US5] Create `docs/security/backup-restore-runbook.md` with staging validation, production backup confirmation, restore test evidence and rollback expectations for RLS/constraint migrations
- [X] T070 [US5] Create `docs/security/manual-scenarios/operational-controls.md` with checks for MFA, redirect URLs, session policy, rate limits, backups, restore and access review
- [X] T071 [US5] Add required operational remediation items to `docs/security/security-control-matrix.md` with risk level, owner, due date and evidence path
- [ ] T072 [US5] Validate US5 by completing `docs/security/manual-scenarios/operational-controls.md` for available environments and recording pass/fail evidence in `docs/security/security-validation-runbook.md`

**Checkpoint**: US5 independently proves operational controls are documented and have validation evidence.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final consistency checks across the security baseline before implementation/hardening work proceeds.

- [X] T073 Run `npm run security:inventory` and update `docs/security/security-control-matrix.md` with any newly discovered surfaces
- [X] T074 Review `docs/security/security-control-matrix.md` and ensure 100% of critical/high items have evidence paths and validation status
- [X] T075 Review `docs/security/security-control-matrix.md` and ensure 100% of medium-risk items have owner, review criteria and review due date within 60 days
- [X] T076 Review `docs/security/security-control-matrix.md` and ensure 100% of low-risk items have owner, review criteria and review due date within 90 days
- [X] T077 Review `docs/security/security-validation-runbook.md` and ensure every scenario from `specs/001-security-parameters/quickstart.md` is represented
- [X] T078 Review `specs/001-security-parameters/contracts/security-baseline-contract.md` against all files in `docs/security/` and document deviations in `docs/security/security-validation-runbook.md`
- [X] T079 Run `npm run lint` and record the result in `docs/security/security-validation-runbook.md`
- [X] T080 Run `npm run test` and record the result in `docs/security/security-validation-runbook.md`
- [X] T081 Run `npm run build` or `npm run verify:deploy` and record the result in `docs/security/security-validation-runbook.md`
- [X] T082 Prepare `docs/security/security-baseline-handoff.md` with completed controls, open risks, blocked validations and recommended next hardening PRs

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: No dependencies.
- **Phase 2 Foundational**: Depends on Phase 1 and blocks all user stories.
- **Phase 3 US1**: Depends on Phase 2. MVP for access control.
- **Phase 4 US2**: Depends on Phase 2. Can run in parallel with US3 after Phase 2.
- **Phase 5 US3**: Depends on Phase 2. Can run in parallel with US2 after Phase 2.
- **Phase 6 US4**: Depends on Phase 2 and benefits from US2/US3 evidence.
- **Phase 7 US5**: Depends on Phase 2 and can run in parallel with US4.
- **Phase 8 Polish**: Depends on all desired user stories.

### User Story Dependencies

- **US1 (P1)**: First MVP because role, organization and client access boundaries anchor the rest of the baseline.
- **US2 (P1)**: Independent after Phase 2, but uses the same security matrix.
- **US3 (P1)**: Independent after Phase 2, but uses the same function inventory.
- **US4 (P2)**: Can start after Phase 2, but should reconcile findings from US2/US3 before final validation.
- **US5 (P2)**: Can start after Phase 2 and does not block US1-US3.

### Parallel Opportunities

- T004, T005, T006 and T007 can run in parallel after T001-T003 are understood.
- T008, T009, T010 and T011 can run in parallel because they inventory different surfaces.
- US1 documentation reviews T019, T020 and T021 can run in parallel.
- US2 reviews T030, T031, T032, T033, T034 and T035 can run in parallel after Phase 2.
- US3 reviews T041, T042, T043, T044, T045, T046, T047 and T048 can run in parallel after Phase 2.
- US4 reviews T053, T054, T055, T056 and T057 can run in parallel after Phase 2.
- US5 documents T063, T064 and T065 can run in parallel after Phase 2.

---

## Parallel Example: User Story 3

```bash
# Parallel review tasks for privileged backend controls:
Task: "Review user functions in supabase/functions/create-team-user/index.ts, supabase/functions/manage-team-user/index.ts, supabase/functions/create-admin/index.ts and supabase/functions/reset-client-portal-passwords/index.ts"
Task: "Review AI and WhatsApp controls in supabase/functions/grow-assistant/index.ts, supabase/functions/grow-assistant-confirm-action/index.ts, supabase/functions/whatsapp-webhook/index.ts and supabase/functions/_shared/ai/"
Task: "Review Open Finance controls in supabase/functions/open-finance-module/index.ts and supabase/functions/open-finance-webhook/index.ts"
Task: "Review Acessorias controls in supabase/functions/acessorias-module/index.ts"
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1 setup documents.
2. Complete Phase 2 inventory scripts and initial security control matrix.
3. Complete Phase 3 US1 access-control documentation and staging validation.
4. Stop and validate that cross-client, department-only and organization-scope scenarios are represented and executable.

### Incremental Delivery

1. Deliver repository-owned baseline structure.
2. Deliver inventory and matrix foundation.
3. Deliver US1 access boundaries.
4. Deliver US2 document/storage controls.
5. Deliver US3 Edge Function/webhook controls.
6. Deliver US4 audit/incident controls.
7. Deliver US5 operational controls.
8. Run final validation and handoff.

### Notes

- Tasks intentionally start with inventory and documentation because the clarified feature is a security baseline, not broad runtime hardening.
- Runtime hardening tasks should be generated from high/critical remediation items discovered in `docs/security/security-control-matrix.md`.
- Do not create new database tables or an admin UI for the first baseline.
- Do not use UI-only controls as completion evidence for sensitive actions.
- Preserve existing user changes in unrelated files while implementing tasks.
