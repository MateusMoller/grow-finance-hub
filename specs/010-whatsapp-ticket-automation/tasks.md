# Tasks: WhatsApp Ticket Automation

**Input**: Design documents from `/specs/010-whatsapp-ticket-automation/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included for backend routing, idempotency, ticket transitions, SLA helpers and key UI flows because the plan defines focused tests and the feature has integration, security and workflow risk.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently after the shared foundation is complete.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files or has no dependency on another incomplete task.
- **[Story]**: Maps the task to the user story from `spec.md`.
- Every task includes exact repository paths.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare feature scaffolding, shared helpers and validation folders without changing runtime behavior.

- [X] T001 Create shared WhatsApp ticket helper directory in `supabase/functions/_shared/whatsapp-ticket/`
- [X] T002 [P] Create frontend ticket helper directory in `src/lib/whatsappTickets.ts`
- [X] T003 [P] Create frontend ticket query hooks placeholder in `src/hooks/useWhatsAppTickets.ts`
- [X] T004 [P] Create feature test folder in `supabase/tests/whatsapp-ticket-automation/`
- [X] T005 [P] Create frontend test folder in `src/components/whatsapp/__tests__/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add the backend-owned model, RLS, idempotency, audit and shared contracts required before any story can safely run.

**CRITICAL**: No user story work should begin until this phase is complete.

- [X] T006 Create migration for customer tickets, task-message links, active contexts, task suggestions, SLA records, ticket events and automation config in `supabase/migrations/YYYYMMDDHHMMSS_whatsapp_ticket_automation.sql`
- [X] T007 Add unique constraints and idempotency indexes for provider message ids, client message ids, public protocols, suggestion approvals and task-message links in `supabase/migrations/YYYYMMDDHHMMSS_whatsapp_ticket_automation.sql`
- [X] T008 Add tenant indexes for organization, client, contact, conversation, ticket, task, status, SLA state and created dates in `supabase/migrations/YYYYMMDDHHMMSS_whatsapp_ticket_automation.sql`
- [X] T009 Add RLS policies for all new ticket automation tables in `supabase/migrations/YYYYMMDDHHMMSS_whatsapp_ticket_automation.sql`
- [X] T010 Add storage policy updates for WhatsApp ticket media previews/downloads in `supabase/migrations/YYYYMMDDHHMMSS_whatsapp_ticket_automation.sql`
- [X] T011 Add TypeScript interfaces for ticket, context, suggestion, SLA and event payloads in `src/lib/whatsappTickets.ts`
- [X] T012 Add shared Deno types for ticket, context, suggestion, SLA and event payloads in `supabase/functions/_shared/whatsapp-ticket/types.ts`
- [X] T013 [P] Implement phone normalization and safe contact matching helpers in `supabase/functions/_shared/whatsapp-ticket/contact-matching.ts`
- [X] T014 [P] Implement append-only ticket event/audit helper in `supabase/functions/_shared/whatsapp-ticket/audit.ts`
- [X] T015 Implement deterministic routing priority helper in `supabase/functions/_shared/whatsapp-ticket/routing.ts`
- [X] T016 Implement public protocol generation helper in `supabase/functions/_shared/whatsapp-ticket/protocol.ts`
- [X] T017 [P] Add unit tests for routing priority in `supabase/tests/whatsapp-ticket-automation/routing.test.ts`
- [X] T018 [P] Add unit tests for idempotency key behavior in `supabase/tests/whatsapp-ticket-automation/idempotency.test.ts`
- [ ] T019 Regenerate Supabase generated types in `src/integrations/supabase/types.ts`

**Checkpoint**: Foundation ready. New tables, policies, types and shared routing/audit helpers exist and can be used by all stories.

---

## Phase 3: User Story 1 - Cliente direciona mensagens para tickets existentes (Priority: P1) MVP

**Goal**: Let an authorized customer choose or reference an existing ticket so inbound messages and attachments are linked to the correct Kanban task.

**Independent Test**: With one active client, one linked contact and one open ticket, customer selects or references the ticket, sends text and media, and both appear in the corresponding task chat without touching unrelated tasks.

### Tests for User Story 1

- [X] T020 [P] [US1] Add webhook routing test for quoted reply to known ticket in `supabase/tests/whatsapp-ticket-automation/quoted-reply-routing.test.ts`
- [X] T021 [P] [US1] Add webhook routing test for selected ticket context in `supabase/tests/whatsapp-ticket-automation/selected-ticket-routing.test.ts`
- [X] T022 [P] [US1] Add access-denied test for unknown or unauthorized phone in `supabase/tests/whatsapp-ticket-automation/contact-access.test.ts`

### Implementation for User Story 1

- [X] T023 [US1] Extend `supabase/functions/whatsapp-webhook/index.ts` to persist inbound messages before routing or classification
- [X] T024 [US1] Extend `supabase/functions/whatsapp-webhook/index.ts` to call routing priority helper for quoted replies, selected ticket, protocol, active context, inference and triage
- [X] T025 [US1] Implement `list_customer_tickets_for_contact` action in `supabase/functions/whatsapp-ticket-actions/index.ts`
- [X] T026 [US1] Implement `select_ticket_context` and `clear_ticket_context` actions in `supabase/functions/whatsapp-ticket-actions/index.ts`
- [X] T027 [US1] Link routed inbound messages and attachments to task/ticket with `customer_reply` or `document` relation in `supabase/functions/_shared/whatsapp-ticket/routing.ts`
- [X] T028 [US1] Preserve manual WhatsApp contact-client links during automatic matching in `supabase/functions/_shared/whatsapp-ticket/contact-matching.ts`
- [X] T029 [US1] Add ticket/context API wrappers in `src/lib/whatsappTickets.ts`
- [ ] T030 [US1] Add active ticket context UI to `src/components/whatsapp/ConversationHeader.tsx`
- [ ] T031 [US1] Add open linked task/ticket navigation in `src/components/whatsapp/ConversationHeader.tsx`
- [ ] T032 [US1] Show ticket-linked message state in `src/components/whatsapp/MessageBubble.tsx`
- [X] T033 [US1] Display only task-linked customer context in `src/components/app/KanbanTaskDetailSheet.tsx`
- [X] T034 [US1] Add bounded query loading for ticket lists in `src/hooks/useWhatsAppTickets.ts`
- [X] T035 [US1] Record route decision ticket events for selected ticket, protocol, context, denied and triage paths in `supabase/functions/_shared/whatsapp-ticket/audit.ts`

**Checkpoint**: US1 is independently usable as the MVP route from WhatsApp message to existing task/ticket.

---

## Phase 4: User Story 2 - Triagem transforma novas solicitacoes em tarefas e tickets (Priority: P1)

**Goal**: Convert uncontexted or new-subject customer messages into reviewable task suggestions, then create Kanban tasks and public tickets after human approval.

**Independent Test**: Send one no-context customer message, review the generated suggestion, approve it, and confirm one Kanban task, one public ticket, one origin link and one customer confirmation are created.

### Tests for User Story 2

- [X] T036 [P] [US2] Add classification-to-suggestion test for single request in `supabase/tests/whatsapp-ticket-automation/task-suggestion.test.ts`
- [X] T037 [P] [US2] Add multiple-request split test in `supabase/tests/whatsapp-ticket-automation/multiple-request-suggestion.test.ts`
- [X] T038 [P] [US2] Add approve-suggestion idempotency test in `supabase/tests/whatsapp-ticket-automation/approve-suggestion-idempotency.test.ts`

### Implementation for User Story 2

- [X] T039 [US2] Implement classification payload builder and confidence rules in `supabase/functions/_shared/whatsapp-ticket/classification.ts`
- [X] T040 [US2] Create task suggestion records from uncontexted messages in `supabase/functions/whatsapp-webhook/index.ts`
- [X] T041 [US2] Implement `create_task_suggestion` action in `supabase/functions/whatsapp-ticket-actions/index.ts`
- [X] T042 [US2] Implement `approve_task_suggestion` action that creates Kanban task, ticket, origin link and audit event in `supabase/functions/whatsapp-ticket-actions/index.ts`
- [X] T043 [US2] Implement `discard_task_suggestion` action with required reason in `supabase/functions/whatsapp-ticket-actions/index.ts`
- [X] T044 [US2] Implement `link_message_to_existing_task` action in `supabase/functions/whatsapp-ticket-actions/index.ts`
- [X] T045 [US2] Send opening confirmation with public protocol, title, responsible and forecast from `supabase/functions/whatsapp-ticket-actions/index.ts`
- [X] T046 [US2] Add triage query wrappers in `src/lib/taskSuggestions.ts`
- [X] T047 [US2] Build triage suggestion list component in `src/components/whatsapp/TriageSuggestionList.tsx`
- [X] T048 [US2] Build suggestion review/edit dialog in `src/components/whatsapp/TriageSuggestionDialog.tsx`
- [X] T049 [US2] Integrate triage panel into `src/pages/WhatsAppAtendimentoPage.tsx`
- [ ] T050 [US2] Add selected-message context picker integration for quick task creation in `src/components/whatsapp/ConversationHeader.tsx`
- [ ] T051 [US2] Record suggestion created, edited, approved, linked existing and discarded events in `supabase/functions/_shared/whatsapp-ticket/audit.ts`

**Checkpoint**: US2 can create reviewed tickets/tasks without relying on the existing ticket routing flow.

---

## Phase 5: User Story 3 - Atendimento conversa pelo chat da tarefa (Priority: P2)

**Goal**: Make the task detail customer chat the safe external communication channel while keeping internal comments/files separate and private.

**Independent Test**: Open a ticket-linked task, send a customer WhatsApp message with task header, mark it as requiring customer response, and add an internal note that never appears in the customer timeline.

### Tests for User Story 3

- [ ] T052 [P] [US3] Add send-message task authorization test in `supabase/tests/whatsapp-ticket-automation/task-chat-send.test.ts`
- [ ] T053 [P] [US3] Add internal-comment visibility test in `supabase/tests/whatsapp-ticket-automation/internal-comment-visibility.test.ts`
- [ ] T054 [P] [US3] Add waiting-customer transition test in `supabase/tests/whatsapp-ticket-automation/waiting-customer.test.ts`

### Implementation for User Story 3

- [X] T055 [US3] Extend `supabase/functions/whatsapp-send-message/index.ts` to accept optional task id, ticket id, reply reference and requires-customer-response flag
- [X] T056 [US3] Format outbound task-context messages with ticket/task header and attendant identity in `supabase/functions/_shared/whatsapp-ticket/task-chat.ts`
- [X] T057 [US3] Persist outbound task-message links with `agent_reply` visibility customer in `supabase/functions/whatsapp-send-message/index.ts`
- [X] T058 [US3] Update task and ticket to waiting customer when requested in `supabase/functions/whatsapp-send-message/index.ts`
- [X] T059 [US3] Reactivate waiting-customer ticket/task on customer reply in `supabase/functions/whatsapp-webhook/index.ts`
- [X] T060 [US3] Add task customer-chat query helpers in `src/lib/whatsappTickets.ts`
- [X] T061 [US3] Replace context-only task WhatsApp panel with ticket-linked customer chat in `src/components/app/KanbanTaskDetailSheet.tsx`
- [X] T062 [US3] Add requires-customer-response control to task WhatsApp composer in `src/components/app/KanbanTaskDetailSheet.tsx`
- [X] T063 [US3] Keep internal progress/chat attachments isolated from customer messages in `src/components/app/KanbanTaskDetailSheet.tsx`
- [ ] T064 [US3] Add notification emission for customer replies to responsible users in `supabase/functions/whatsapp-webhook/index.ts`

**Checkpoint**: US3 supports external task communication and internal comments without data leakage.

---

## Phase 6: User Story 4 - Conclusao, reabertura e encerramento de tickets (Priority: P2)

**Goal**: Resolve, close and reopen tickets according to task completion, customer replies and configured quiet periods.

**Independent Test**: Complete a ticket-linked task with required summary, confirm the client receives completion, then verify thanks do not reopen and a related divergence reopens or goes to triage.

### Tests for User Story 4

- [ ] T065 [P] [US4] Add completion-blocking validation test in `supabase/tests/whatsapp-ticket-automation/complete-ticket-task.test.ts`
- [X] T066 [P] [US4] Add thank-you-no-reopen test in `supabase/tests/whatsapp-ticket-automation/no-reopen-confirmation.test.ts`
- [X] T067 [P] [US4] Add related-divergence reopen test in `supabase/tests/whatsapp-ticket-automation/reopen-ticket.test.ts`

### Implementation for User Story 4

- [X] T068 [US4] Implement `complete_ticket_task` action with completion summary validation in `supabase/functions/whatsapp-ticket-actions/index.ts`
- [X] T069 [US4] Implement `resolve_ticket`, `close_ticket` and `reopen_ticket` actions in `supabase/functions/whatsapp-ticket-actions/index.ts`
- [X] T070 [US4] Send customer completion message from `supabase/functions/whatsapp-ticket-actions/index.ts`
- [X] T071 [US4] Add classification rules for thanks, confirmations, divergences and new subjects after resolved/closed state in `supabase/functions/_shared/whatsapp-ticket/classification.ts`
- [X] T072 [US4] Route post-resolution customer messages to no-op, reopen or new suggestion in `supabase/functions/whatsapp-webhook/index.ts`
- [ ] T073 [US4] Add completion UI fields and validation hints to `src/components/app/KanbanTaskDetailSheet.tsx`
- [ ] T074 [US4] Display ticket resolution/reopen events in task history in `src/components/app/KanbanTaskDetailSheet.tsx`
- [ ] T075 [US4] Record completion, resolved, closed, reopened and cancelled ticket events in `supabase/functions/_shared/whatsapp-ticket/audit.ts`

**Checkpoint**: US4 provides a complete ticket lifecycle without automatically reopening for irrelevant replies.

---

## Phase 7: User Story 5 - Gestao por SLA, alertas e relatorios (Priority: P3)

**Goal**: Give leaders and admins SLA, reminders, closure automation, operational alerts and reporting over tickets and WhatsApp-originated tasks.

**Independent Test**: Configure short SLA/reminder windows, create tickets, verify warning/reminder/closure jobs run without opening the app, and review results in management views.

### Tests for User Story 5

- [X] T076 [P] [US5] Add SLA threshold helper test in `supabase/tests/whatsapp-ticket-automation/sla-thresholds.test.ts`
- [ ] T077 [P] [US5] Add waiting-customer reminder schedule test in `supabase/tests/whatsapp-ticket-automation/reminder-schedule.test.ts`
- [ ] T078 [P] [US5] Add resolved-ticket closure test in `supabase/tests/whatsapp-ticket-automation/close-resolved-ticket.test.ts`

### Implementation for User Story 5

- [X] T079 [US5] Implement SLA calculation helpers in `supabase/functions/_shared/whatsapp-ticket/sla.ts`
- [X] T080 [US5] Implement expire-contexts scheduled handler in `supabase/functions/whatsapp-ticket-automations/index.ts`
- [X] T081 [US5] Implement SLA alerts scheduled handler in `supabase/functions/whatsapp-ticket-automations/index.ts`
- [X] T082 [US5] Implement waiting-customer reminders scheduled handler in `supabase/functions/whatsapp-ticket-automations/index.ts`
- [X] T083 [US5] Implement close-resolved-tickets scheduled handler in `supabase/functions/whatsapp-ticket-automations/index.ts`
- [X] T084 [US5] Implement safe failure reprocessing handler in `supabase/functions/whatsapp-ticket-automations/index.ts`
- [ ] T085 [US5] Add notification records for SLA warnings, SLA breaches, reminders and reopened tickets in `supabase/functions/_shared/whatsapp-ticket/audit.ts`
- [ ] T086 [US5] Add admin configuration UI for context, SLA, reminders and default messages in `src/pages/ConfiguracoesPage.tsx`
- [ ] T087 [US5] Add ticket/SLA management query helpers in `src/hooks/useWhatsAppTickets.ts`
- [ ] T088 [US5] Add ticket/SLA management cards and filters to `src/pages/WhatsAppAtendimentoPage.tsx`
- [ ] T089 [US5] Add ticket metrics to reports data layer in `src/hooks/reports/useReports.ts`
- [ ] T090 [US5] Add ticket metrics section to reports UI in `src/pages/RelatoriosPage.tsx`

**Checkpoint**: US5 supplies operational control, reporting and background automation over tickets.

---

## Final Phase: Polish & Cross-Cutting Concerns

**Purpose**: Validate security, performance, UX and deployment readiness across all completed stories.

- [ ] T091 [P] Update quickstart with actual deployed function names and callback notes in `specs/010-whatsapp-ticket-automation/quickstart.md`
- [X] T092 [P] Add rollback notes for migrations and scheduled jobs in `supabase/migrations/YYYYMMDDHHMMSS_whatsapp_ticket_automation.sql`
- [X] T093 Review tenant isolation and RLS policies for all new tables and buckets in `supabase/migrations/YYYYMMDDHHMMSS_whatsapp_ticket_automation.sql`
- [X] T094 Review provider token handling and ensure all WhatsApp secrets remain only in Supabase function environment variables in `supabase/functions/whatsapp-webhook/index.ts`
- [ ] T095 Review high-volume message and ticket rendering for pagination, bounded arrays and derived state in `src/pages/WhatsAppAtendimentoPage.tsx`
- [ ] T096 Review task detail rendering cost and customer/internal message separation in `src/components/app/KanbanTaskDetailSheet.tsx`
- [ ] T097 Run manual quickstart validation from `specs/010-whatsapp-ticket-automation/quickstart.md`
- [X] T098 Run `npm run lint`
- [X] T099 Run `npm run test`
- [X] T100 Run `npm run build`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: No dependencies.
- **Phase 2 Foundational**: Depends on Phase 1 and blocks every user story.
- **US1 MVP**: Depends on Phase 2.
- **US2**: Depends on Phase 2; can run parallel with US1 after shared ticket schema exists, but opening confirmation benefits from US1 message helpers.
- **US3**: Depends on Phase 2 and benefits from US1 ticket-message links.
- **US4**: Depends on US3 for task-chat and completion integration.
- **US5**: Depends on Phase 2; reporting cards are most useful after US1-US4 produce ticket/SLA events.
- **Final Phase**: Depends on all desired stories for the release.

### User Story Dependencies

- **US1 (P1)**: MVP; no dependency on other user stories.
- **US2 (P1)**: Independent triage flow; can be delivered after foundation even before all routing UX is complete.
- **US3 (P2)**: Requires tickets/task-message links from foundation and is stronger after US1.
- **US4 (P2)**: Requires ticket/task lifecycle and task customer chat.
- **US5 (P3)**: Requires ticket, SLA and event data; can be built incrementally after foundation.

### Within Each User Story

- Tests before implementation where listed.
- Data contracts and helper functions before Edge Function actions.
- Edge Function actions before React integrations that call them.
- UI presentation before final quickstart/manual validation.
- Audit and notification events before story checkpoint.

---

## Parallel Opportunities

- T002-T005 can run in parallel after T001.
- T013, T014, T017 and T018 can run in parallel after T006-T012 are drafted.
- US1 tests T020-T022 can run in parallel.
- US2 tests T036-T038 can run in parallel.
- US3 tests T052-T054 can run in parallel.
- US4 tests T065-T067 can run in parallel.
- US5 tests T076-T078 can run in parallel.
- US5 automation handlers T080-T084 can be split after T079 defines shared SLA behavior.
- Final documentation/security/performance reviews T091-T096 can run in parallel after implementation is stable.

---

## Parallel Example: User Story 1

```text
Task: "T020 [P] [US1] Add webhook routing test for quoted reply to known ticket in supabase/tests/whatsapp-ticket-automation/quoted-reply-routing.test.ts"
Task: "T021 [P] [US1] Add webhook routing test for selected ticket context in supabase/tests/whatsapp-ticket-automation/selected-ticket-routing.test.ts"
Task: "T022 [P] [US1] Add access-denied test for unknown or unauthorized phone in supabase/tests/whatsapp-ticket-automation/contact-access.test.ts"
```

## Parallel Example: User Story 2

```text
Task: "T046 [US2] Add triage query wrappers in src/lib/taskSuggestions.ts"
Task: "T047 [US2] Build triage suggestion list component in src/components/whatsapp/TriageSuggestionList.tsx"
Task: "T048 [US2] Build suggestion review/edit dialog in src/components/whatsapp/TriageSuggestionDialog.tsx"
```

## Parallel Example: User Story 5

```text
Task: "T080 [US5] Implement expire-contexts scheduled handler in supabase/functions/whatsapp-ticket-automations/index.ts"
Task: "T081 [US5] Implement SLA alerts scheduled handler in supabase/functions/whatsapp-ticket-automations/index.ts"
Task: "T082 [US5] Implement waiting-customer reminders scheduled handler in supabase/functions/whatsapp-ticket-automations/index.ts"
Task: "T083 [US5] Implement close-resolved-tickets scheduled handler in supabase/functions/whatsapp-ticket-automations/index.ts"
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1.
2. Complete Phase 2.
3. Complete US1 only.
4. Validate with quickstart Story 1 and regression checks for duplicate webhook, unknown phone and manual client link preservation.
5. Deploy/demo the MVP if routing to existing tickets is stable.

### Incremental Delivery

1. Foundation.
2. US1 existing ticket routing.
3. US2 supervised triage and task/ticket creation.
4. US3 task customer chat.
5. US4 completion/reopen/closure.
6. US5 SLA, automations and reports.

### Validation Commands

```bash
npm run lint
npm run test
npm run build
```

### Notes

- Keep business rules in Supabase functions, SQL and scheduled jobs.
- Keep React responsible for presentation, optimistic feedback and bounded loading only.
- Preserve internal/customer separation for every message, attachment, audit entry and event.
- Do not expose WhatsApp credentials, provider payload secrets or service-role access to browser code.
