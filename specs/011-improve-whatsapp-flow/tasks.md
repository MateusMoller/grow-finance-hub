# Tasks: Improved WhatsApp Message Flow

**Input**: Design documents from `specs/011-improve-whatsapp-flow/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Automated tests are not explicitly required by the spec. This plan includes manual validation tasks from `quickstart.md` plus project validation commands.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare the current WhatsApp implementation for controlled flow changes.

- [X] T001 Review current inbound routing and action handlers in `supabase/functions/whatsapp-webhook/index.ts`
- [X] T002 Review current outbound provider failure handling in `supabase/functions/_shared/whatsapp-provider.ts`
- [X] T003 [P] Review current interactive message helpers in `supabase/functions/_shared/whatsapp-ticket/interactive-messages.ts`
- [X] T004 [P] Review current WhatsApp UI composition in `src/pages/WhatsAppAtendimentoPage.tsx`
- [X] T005 [P] Review current conversation list and panel components in `src/components/whatsapp/ConversationList.tsx` and `src/components/whatsapp/ConversationPanel.tsx`
- [X] T006 [P] Review existing WhatsApp type definitions in `src/lib/whatsappTypes.ts`
- [X] T007 Confirm whether existing tables support flow blocking, last greeting date, and delivery-failure audit by inspecting `supabase/migrations/`
- [X] T008 Create a short implementation notes section in `specs/011-improve-whatsapp-flow/quickstart.md` if any existing table or Edge Function constraint changes the implementation path

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared backend contracts, state, safety, and text normalization required by all stories.

**Critical**: No user story work should begin until this phase is complete.

- [X] T009 Define shared action constants for `menu`, `attendance`, `requests`, `consult_tasks`, `create_task`, and `end_flow` in `supabase/functions/_shared/whatsapp-ticket/protocol.ts`
- [X] T010 Define shared office-hours helper for Monday-Friday until 17:00 Sao Paulo time in `supabase/functions/_shared/whatsapp-ticket/routing.ts`
- [X] T011 Define shared client-link validation helper for WhatsApp task consultation and creation in `supabase/functions/_shared/whatsapp-ticket/contact-matching.ts`
- [X] T012 Define shared delivery-failure classification helper in `supabase/functions/_shared/whatsapp-provider.ts`
- [X] T013 Update audit helper to record greeting, menu, action selection, task creation, queue routing, delivery failure, and flow end events in `supabase/functions/_shared/whatsapp-ticket/audit.ts`
- [X] T014 Add or update migration for automatic flow blocking fields if missing in `supabase/migrations/`
- [X] T015 Add or update migration indexes for bounded task lookup by organization, client, and open status in `supabase/migrations/`
- [X] T016 Add or update migration/RLS checks so WhatsApp request types remain organization-scoped in `supabase/migrations/`
- [X] T017 Update generated/shared TypeScript types for new or changed WhatsApp flow fields in `src/lib/whatsappTypes.ts`
- [X] T018 Normalize all automatic WhatsApp texts to professional Portuguese without corrupted encoding in `supabase/functions/_shared/whatsapp-ticket/interactive-messages.ts`
- [X] T019 Ensure provider tokens, phone IDs, and service-role secrets remain server-only in `supabase/functions/whatsapp-webhook/index.ts`
- [X] T020 Ensure all automatic send operations use a single idempotency key per inbound provider message in `supabase/functions/whatsapp-webhook/index.ts`

**Checkpoint**: Foundation ready; user stories can now be implemented.

---

## Phase 3: User Story 1 - Client Starts a Clear Conversation (Priority: P1) MVP

**Goal**: Send one daily time-based greeting and a simple two-option main menu.

**Independent Test**: Send a first WhatsApp message from linked and unlinked contacts; confirm one daily greeting, correct naming, and only the two primary menu choices.

### Implementation for User Story 1

- [X] T021 [P] [US1] Implement daily greeting eligibility lookup by organization, conversation, and local date in `supabase/functions/whatsapp-webhook/index.ts`
- [X] T022 [P] [US1] Implement linked-client greeting name resolution in `supabase/functions/_shared/whatsapp-ticket/contact-matching.ts`
- [X] T023 [US1] Implement time-based greeting text for linked and unlinked contacts in `supabase/functions/_shared/whatsapp-ticket/interactive-messages.ts`
- [X] T024 [US1] Replace initial automatic menu with only `Falar com a equipe` and `Solicitacoes` in `supabase/functions/_shared/whatsapp-ticket/interactive-messages.ts`
- [X] T025 [US1] Route first-message handling to send greeting before menu only once per local day in `supabase/functions/whatsapp-webhook/index.ts`
- [X] T026 [US1] Record greeting sent or skipped events in `supabase/functions/_shared/whatsapp-ticket/audit.ts`
- [X] T027 [US1] Ensure menu send idempotency prevents duplicate initial menus for the same inbound message in `supabase/functions/whatsapp-webhook/index.ts`
- [X] T028 [P] [US1] Update message preview labels for greeting/menu messages in `src/lib/whatsappMessagePreview.ts`
- [ ] T029 [US1] Manually validate linked and unlinked first-message scenarios from `specs/011-improve-whatsapp-flow/quickstart.md`

**Checkpoint**: US1 works independently as the MVP entry flow.

---

## Phase 4: User Story 2 - Client Requests Human Attendance (Priority: P1)

**Goal**: Route clients to human attendance with office-hours-aware responses and internal notifications.

**Independent Test**: Select `Falar com a equipe` during and outside office hours; confirm queue placement, visual unread indicator, and the correct client-facing response.

### Implementation for User Story 2

- [X] T030 [P] [US2] Implement free-text intent matching for human attendance in `supabase/functions/whatsapp-webhook/index.ts`
- [X] T031 [US2] Apply Monday-Friday until 17:00 office-hours helper to attendance routing in `supabase/functions/whatsapp-webhook/index.ts`
- [X] T032 [US2] Implement inside-office-hours attendance response in `supabase/functions/_shared/whatsapp-ticket/interactive-messages.ts`
- [X] T033 [US2] Implement outside-office-hours attendance response in `supabase/functions/_shared/whatsapp-ticket/interactive-messages.ts`
- [X] T034 [US2] Ensure outside-office-hours attendance requests still enter the internal attendance queue in `supabase/functions/whatsapp-webhook/index.ts`
- [X] T035 [US2] Create internal notification for attendance requests in `supabase/functions/whatsapp-ticket-actions/index.ts`
- [X] T036 [US2] Update WhatsApp module conversation tabs and unread indicators for attendance queue visibility in `src/pages/WhatsAppAtendimentoPage.tsx`
- [X] T037 [P] [US2] Update conversation list badge rendering for attendance notifications in `src/components/whatsapp/ConversationList.tsx`
- [X] T038 [US2] Ensure manual attendance closing sends institutional farewell without attendant header in `supabase/functions/whatsapp-ticket-actions/index.ts`
- [X] T039 [US2] Record attendance requested, after-hours response, and attendance closed events in `supabase/functions/_shared/whatsapp-ticket/audit.ts`
- [ ] T040 [US2] Manually validate human attendance and after-hours scenarios from `specs/011-improve-whatsapp-flow/quickstart.md`

**Checkpoint**: US2 routes attendance safely and independently.

---

## Phase 5: User Story 3 - Client Manages Requests (Priority: P1)

**Goal**: Let linked clients consult open tasks or create a new request through WhatsApp using request types and minimal fields.

**Independent Test**: Select `Solicitacoes`, consult tasks for a linked client, create a new request, and confirm the internal task/ticket contains the collected context.

### Implementation for User Story 3

- [X] T041 [P] [US3] Implement `Solicitacoes` request submenu with `Consultar tarefas` and `Nova solicitacao` in `supabase/functions/_shared/whatsapp-ticket/interactive-messages.ts`
- [X] T042 [US3] Route requests submenu actions and free-text equivalents in `supabase/functions/whatsapp-webhook/index.ts`
- [X] T043 [US3] Enforce reliable linked-client requirement before task consultation in `supabase/functions/whatsapp-webhook/index.ts`
- [X] T044 [US3] Query only operational open tasks for the linked client using bounded results in `supabase/functions/whatsapp-webhook/index.ts`
- [X] T045 [US3] Exclude completed and archived tasks from WhatsApp consultation results in `supabase/functions/whatsapp-webhook/index.ts`
- [X] T046 [US3] Format each consulted task with ticket number, title, and status in `supabase/functions/_shared/whatsapp-ticket/interactive-messages.ts`
- [X] T047 [US3] Enforce reliable linked-client requirement before WhatsApp task creation in `supabase/functions/whatsapp-webhook/index.ts`
- [X] T048 [US3] Route unlinked contacts attempting task creation to identification or human attendance in `supabase/functions/whatsapp-webhook/index.ts`
- [X] T049 [US3] Load active request types ordered by configuration for WhatsApp choices in `supabase/functions/whatsapp-webhook/index.ts`
- [X] T050 [US3] Ensure generic request type does not default to Societario unless explicitly configured in `supabase/functions/whatsapp-webhook/index.ts`
- [X] T051 [US3] Collect only request type, title/summary, description/context, and optional attachments in `supabase/functions/whatsapp-webhook/index.ts`
- [X] T052 [US3] Preserve active-flow messages as task context without collecting dynamic portal form fields in `supabase/functions/whatsapp-webhook/index.ts`
- [X] T053 [US3] Create internal task and customer ticket idempotently after required answers in `supabase/functions/whatsapp-ticket-automations/index.ts`
- [X] T054 [US3] Link WhatsApp attachments from the active flow to the generated task context in `supabase/functions/whatsapp-ticket-automations/index.ts`
- [X] T055 [US3] Send ticket confirmation with ticket number, title, and responsible party in `supabase/functions/_shared/whatsapp-ticket/interactive-messages.ts`
- [X] T056 [US3] Prevent duplicate task/ticket creation from the same flow or inbound message in `supabase/functions/whatsapp-ticket-automations/index.ts`
- [X] T057 [P] [US3] Update task/ticket display helpers for WhatsApp-created tasks in `src/lib/whatsappTickets.ts`
- [ ] T058 [US3] Manually validate consult-tasks, no-task, unlinked-contact, and create-task scenarios from `specs/011-improve-whatsapp-flow/quickstart.md`

**Checkpoint**: US3 provides client-scoped request management without exposing internal sectors.

---

## Phase 6: User Story 4 - Client Continues or Ends the Flow (Priority: P2)

**Goal**: Every flow ending offers consistent options to return to the main menu or end the automatic flow.

**Independent Test**: Complete consultation, no-result, task creation, and cancellation paths; confirm each path ends with `Voltar ao menu` and `Encerrar`.

### Implementation for User Story 4

- [X] T059 [P] [US4] Implement shared final-actions message with `Voltar ao menu` and `Encerrar` in `supabase/functions/_shared/whatsapp-ticket/interactive-messages.ts`
- [X] T060 [US4] Send final actions after task consultation success and no-result states in `supabase/functions/whatsapp-webhook/index.ts`
- [X] T061 [US4] Send final actions after new task confirmation in `supabase/functions/whatsapp-ticket-automations/index.ts`
- [X] T062 [US4] Implement cancel intent handling for active task creation flows in `supabase/functions/whatsapp-webhook/index.ts`
- [X] T063 [US4] Implement `Voltar ao menu` to clear temporary automatic context and resend the main menu in `supabase/functions/whatsapp-webhook/index.ts`
- [X] T064 [US4] Implement `Encerrar` to clear automatic context without reopening the menu in `supabase/functions/whatsapp-webhook/index.ts`
- [X] T065 [US4] Record cancellation, return-to-menu, and automatic-flow-ended events in `supabase/functions/_shared/whatsapp-ticket/audit.ts`
- [ ] T066 [US4] Manually validate final-action consistency from `specs/011-improve-whatsapp-flow/quickstart.md`

**Checkpoint**: US4 removes dead ends and inconsistent return labels.

---

## Phase 7: User Story 5 - Internal Team Receives Useful Context (Priority: P2)

**Goal**: Internal users see enough context, attachments, delivery failure state, and routing information to act without asking the client to repeat details.

**Independent Test**: Create a WhatsApp request with text and attachments; open the internal task and conversation; confirm source context, files, and failure states are visible.

### Implementation for User Story 5

- [X] T067 [P] [US5] Display WhatsApp-created task source metadata in `src/components/whatsapp/ConversationPanel.tsx`
- [X] T068 [P] [US5] Display task/ticket context links in WhatsApp message bubbles in `src/components/whatsapp/MessageBubble.tsx`
- [X] T069 [US5] Ensure attachments received during task creation are available below the generated task context in `src/components/whatsapp/ConversationPanel.tsx`
- [X] T070 [US5] Show delivery-failure alerts in the conversation without treating failed messages as delivered in `src/components/whatsapp/MessageBubble.tsx`
- [X] T071 [US5] Stop frontend flow controls from suggesting success when the backend reports provider failure in `src/lib/whatsappFunctionErrors.ts`
- [X] T072 [US5] Ensure conversation state indicates blocked automatic progression after provider failure in `src/lib/whatsappConversations.ts`
- [X] T073 [US5] Add internal action or retry affordance only for explicitly valid retry paths in `src/components/whatsapp/ConversationHeader.tsx`
- [ ] T074 [US5] Manually validate delivery-failure and task-context scenarios from `specs/011-improve-whatsapp-flow/quickstart.md`

**Checkpoint**: US5 gives the team operational context and controlled failure handling.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Finish quality, consistency, validation, and deploy readiness across the feature.

- [X] T075 Review all automatic Portuguese message text for accents, tone, and absence of corrupted characters in `supabase/functions/_shared/whatsapp-ticket/interactive-messages.ts`
- [X] T076 Review WhatsApp UI spacing, readable message grouping, and visual hierarchy in `src/pages/WhatsAppAtendimentoPage.tsx`
- [X] T077 [P] Review React render cost and query scopes in `src/hooks/useWhatsAppConversations.ts`
- [X] T078 [P] Review React render cost and query scopes in `src/hooks/useWhatsAppMessages.ts`
- [X] T079 Review Edge Function logs to ensure secrets and tokens are not logged in `supabase/functions/whatsapp-webhook/index.ts`
- [X] T080 Review RLS, storage policy, and signed URL impact for WhatsApp attachments in `supabase/migrations/`
- [ ] T081 Run manual linked-client and unlinked-contact WhatsApp validation from `specs/011-improve-whatsapp-flow/quickstart.md`
- [ ] T082 Run manual provider-failure validation from `specs/011-improve-whatsapp-flow/quickstart.md`
- [X] T083 Run `npm run lint`
- [X] T084 Run `npm run test`
- [X] T085 Run `npm run build`
- [X] T086 Update implementation notes and any known provider limitations in `specs/011-improve-whatsapp-flow/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup completion and blocks all user stories.
- **User Stories (Phases 3-7)**: Depend on Foundational completion.
- **Polish (Phase 8)**: Depends on all implemented stories selected for delivery.

### User Story Dependencies

- **US1 (P1)**: Can start after Foundation; MVP entry flow.
- **US2 (P1)**: Can start after Foundation; independent of US1 except shared menu constants.
- **US3 (P1)**: Can start after Foundation; depends on shared client-link validation and request-type helpers.
- **US4 (P2)**: Can start after Foundation, but is most useful after US1-US3 paths exist.
- **US5 (P2)**: Can start after Foundation and can proceed in parallel with US4 after backend state is available.

### Within Each User Story

- Shared helpers before webhook routing.
- Backend routing before frontend state display.
- Idempotency and audit before manual validation.
- Manual validation before final build/deploy readiness.

---

## Parallel Opportunities

- T003, T004, T005, and T006 can run in parallel during Setup.
- T010, T011, T012, and T013 can be drafted in parallel once current code review is done.
- T021 and T022 can run in parallel for US1.
- T030 and T037 can run in parallel for US2.
- T041 and T057 can run in parallel for US3.
- T059 can run in parallel with T062 for US4.
- T067 and T068 can run in parallel for US5.
- T077 and T078 can run in parallel during Polish.

---

## Parallel Example: User Story 3

```text
Task: "Implement `Solicitacoes` request submenu with `Consultar tarefas` and `Nova solicitacao` in `supabase/functions/_shared/whatsapp-ticket/interactive-messages.ts`"
Task: "Update task/ticket display helpers for WhatsApp-created tasks in `src/lib/whatsappTickets.ts`"
```

After those complete, continue with linked-client enforcement, bounded task lookup, request collection, idempotent task creation, and manual validation.

---

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2.
2. Implement US1 to stabilize entry greeting and main menu.
3. Validate US1 independently with linked and unlinked contacts.
4. Add US2 and US3 before exposing the flow broadly to clients.

### Incremental Delivery

1. US1: Daily greeting and two-option menu.
2. US2: Human attendance queue and after-hours behavior.
3. US3: Client-scoped task consultation and task creation.
4. US4: Consistent endings and cancel/return behavior.
5. US5: Internal context, attachments, and delivery-failure visibility.

### Quality Gates

1. Manual WhatsApp validation from `quickstart.md`.
2. `npm run lint`.
3. `npm run test`.
4. `npm run build`.
