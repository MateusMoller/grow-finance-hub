# Tasks: WhatsApp Client Chat

**Input**: Design documents from `/specs/008-whatsapp-client-chat/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Include focused validation and contract fixture tasks because the plan requires `npm run test`, webhook fixture checks, RLS checks, and quickstart validation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files and has no dependency on another incomplete task in the same phase.
- **[Story]**: Maps task to user story (`US1`, `US2`, `US3`, `US4`).
- Every task includes an explicit target path.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare module keys, route entry points, documentation references, and integration configuration placeholders.

- [X] T001 Add WhatsApp atendimento module key and display label in `src/lib/userPermissions.ts`
- [X] T002 Add WhatsApp atendimento route permission mapping in `src/lib/userPermissions.ts`
- [X] T003 Add sidebar navigation entry for WhatsApp atendimento in `src/components/app/AppLayout.tsx`
- [X] T004 Add protected app route for `/app/whatsapp` in `src/App.tsx`
- [X] T005 [P] Create placeholder page shell in `src/pages/WhatsAppAtendimentoPage.tsx`
- [X] T006 [P] Create WhatsApp component directory with barrel exports in `src/components/whatsapp/index.ts`
- [X] T007 [P] Create WhatsApp feature constants and type helpers in `src/lib/whatsappTypes.ts`
- [X] T008 Document required runtime secrets in `supabase/functions/whatsapp-webhook/README.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core schema, RLS, storage, Edge Function scaffolding, and shared data access needed by all user stories.

**Critical**: No user story work can begin until this phase is complete.

- [X] T009 Create Supabase migration for WhatsApp contacts, conversations, messages, attachments, assignments, events, notifications, active window fields, indexes, constraints, RLS, and storage bucket in `supabase/migrations/20260716190002_add_whatsapp_client_chat.sql`
- [ ] T010 Add generated Supabase table/storage types for WhatsApp data in `src/integrations/supabase/types.ts`
- [X] T011 [P] Create shared WhatsApp Edge Function auth helpers in `supabase/functions/_shared/whatsapp-auth.ts`
- [X] T012 [P] Create shared WhatsApp payload validation helpers in `supabase/functions/_shared/whatsapp-validation.ts`
- [X] T013 [P] Create shared WhatsApp provider normalization helpers in `supabase/functions/_shared/whatsapp-provider.ts`
- [X] T014 [P] Create shared WhatsApp audit/event helper in `supabase/functions/_shared/whatsapp-events.ts`
- [X] T015 Scaffold webhook Edge Function with verification route in `supabase/functions/whatsapp-webhook/index.ts`
- [X] T016 Scaffold outbound send Edge Function with authenticated action dispatch in `supabase/functions/whatsapp-send-message/index.ts`
- [X] T017 Scaffold media Edge Function with authenticated action dispatch in `supabase/functions/whatsapp-media/index.ts`
- [X] T018 [P] Create frontend conversation data access module in `src/lib/whatsappConversations.ts`
- [X] T019 [P] Create frontend message data access module in `src/lib/whatsappMessages.ts`
- [X] T020 [P] Create frontend media data access module in `src/lib/whatsappMedia.ts`
- [X] T021 [P] Create webhook fixture samples for inbound text, status update, duplicate event, and inbound media in `supabase/functions/whatsapp-webhook/fixtures/messages.json`
- [X] T022 Add targeted RLS verification SQL for WhatsApp tables and storage policies in `supabase/tests/whatsapp_client_chat_rls.sql`
- [X] T023 Add WhatsApp module access checks to user management permissions list in `src/pages/UsuariosPage.tsx`

**Checkpoint**: Foundation ready. User story implementation can begin.

---

## Phase 3: User Story 1 - Atender cliente pelo WhatsApp dentro do sistema (Priority: P1) MVP

**Goal**: Internal user can open the WhatsApp module, see a conversation, read chronological messages, send a text reply, and receive active updates without manual refresh.

**Independent Test**: Seed one contact, one conversation, and messages; open `/app/whatsapp`; verify the two-pane UI renders the conversation, sends a text message once, and updates the active timeline from a simulated inbound event.

### Implementation for User Story 1

- [X] T024 [P] [US1] Implement conversation list query with pagination and recent-first ordering in `src/lib/whatsappConversations.ts`
- [X] T025 [P] [US1] Implement message timeline query with recent-first loading and older-message cursor in `src/lib/whatsappMessages.ts`
- [X] T026 [P] [US1] Implement inbound text webhook normalization, active window refresh, unique active client auto-linking, and upsert flow in `supabase/functions/whatsapp-webhook/index.ts`
- [X] T027 [US1] Implement outbound text send flow with active window enforcement, backend idempotency, provider dispatch, and audit event in `supabase/functions/whatsapp-send-message/index.ts`
- [X] T028 [US1] Implement delivery status normalization and message state update in `supabase/functions/whatsapp-webhook/index.ts`
- [X] T029 [US1] Create `useWhatsAppConversations` TanStack Query hook in `src/hooks/useWhatsAppConversations.ts`
- [X] T030 [US1] Create `useWhatsAppMessages` TanStack Query hook in `src/hooks/useWhatsAppMessages.ts`
- [X] T031 [US1] Create `useWhatsAppRealtime` subscription hook for conversation/message/status events in `src/hooks/useWhatsAppRealtime.ts`
- [X] T032 [P] [US1] Build WhatsApp-style conversation list component in `src/components/whatsapp/ConversationList.tsx`
- [X] T033 [P] [US1] Build active conversation panel component in `src/components/whatsapp/ConversationPanel.tsx`
- [X] T034 [P] [US1] Build message bubble component with inbound/outbound styling and delivery state in `src/components/whatsapp/MessageBubble.tsx`
- [X] T035 [P] [US1] Build text composer with Enter-to-send, Shift+Enter newline, disabled sending state, and duplicate-send guard in `src/components/whatsapp/MessageComposer.tsx`
- [X] T036 [US1] Compose MVP two-pane WhatsApp atendimento page in `src/pages/WhatsAppAtendimentoPage.tsx`
- [X] T037 [US1] Add read-state update when opening a conversation in `src/lib/whatsappMessages.ts`
- [X] T038 [US1] Wire realtime invalidation and active timeline append behavior in `src/pages/WhatsAppAtendimentoPage.tsx`
- [X] T039 [US1] Add controlled empty, loading, blocked, and send-failed states in `src/pages/WhatsAppAtendimentoPage.tsx`
- [X] T040 [US1] Add contract fixture validation for inbound text and duplicate webhook handling in `supabase/functions/whatsapp-webhook/index.ts`

**Checkpoint**: MVP conversation reading/sending is independently usable.

---

## Phase 4: User Story 2 - Gerenciar fila de conversas e priorizar atendimento (Priority: P2)

**Goal**: Internal user can prioritize conversations by unread status, latest message, client, responsible user, status, date range, and search.

**Independent Test**: Seed multiple conversations with different statuses, unread counts, assignees, clients, and timestamps; verify ordering, markers, filters, and counters work without opening each conversation.

### Implementation for User Story 2

- [X] T041 [P] [US2] Extend conversation list query filters for unread, status, assignee, client, date range, and search in `src/lib/whatsappConversations.ts`
- [X] T042 [P] [US2] Add indexed search/support fields to migration for phone, contact name, client id, status, assigned user, and last message timestamp in `supabase/migrations/20260716190002_add_whatsapp_client_chat.sql`
- [X] T043 [US2] Build conversation filter bar with search and segmented filters in `src/components/whatsapp/ConversationFilters.tsx`
- [X] T044 [US2] Add unread badges, latest preview, timestamp, and assignment indicator in `src/components/whatsapp/ConversationList.tsx`
- [X] T045 [US2] Add bounded pagination and load-more behavior for conversation list in `src/hooks/useWhatsAppConversations.ts`
- [X] T046 [US2] Add URL/query-state preservation for active filters and selected conversation in `src/pages/WhatsAppAtendimentoPage.tsx`
- [X] T047 [US2] Add unread and assignment notification generation from inbound webhook events, targeting the responsible user when assigned and eligible queue/team users when unassigned, in `supabase/functions/whatsapp-webhook/index.ts`
- [X] T048 [US2] Add WhatsApp notification click target behavior in `src/components/app/AppLayout.tsx`
- [X] T049 [US2] Add fixture validation for new-message notification creation in `supabase/functions/whatsapp-webhook/fixtures/messages.json`

**Checkpoint**: Queue management works independently from attachment and assignment workflows.

---

## Phase 5: User Story 3 - Compartilhar anexos e registrar contexto do atendimento (Priority: P3)

**Goal**: Internal users can receive and send allowed attachments, see safe metadata in the timeline, and keep media scoped to the organization and conversation.

**Independent Test**: Simulate inbound media and send an outbound allowed file; verify metadata, storage path, short-lived access, failure handling, and timeline rendering.

### Implementation for User Story 3

- [X] T050 [P] [US3] Implement inbound media metadata handling and attachment record creation in `supabase/functions/whatsapp-webhook/index.ts`
- [ ] T051 [US3] Implement provider media retrieval and organization-scoped storage in `supabase/functions/whatsapp-media/index.ts`
- [ ] T052 [US3] Implement outbound attachment validation, active window enforcement, storage, provider dispatch, and idempotency in `supabase/functions/whatsapp-send-message/index.ts`
- [X] T053 [P] [US3] Add file type, file size, and storage-path validation helpers in `supabase/functions/_shared/whatsapp-validation.ts`
- [X] T054 [P] [US3] Add attachment upload and signed access helpers in `src/lib/whatsappMedia.ts`
- [X] T055 [US3] Add attachment action menu to message composer in `src/components/whatsapp/MessageComposer.tsx`
- [X] T056 [US3] Add attachment preview/download rendering to message bubbles in `src/components/whatsapp/MessageBubble.tsx`
- [X] T057 [US3] Add client/contact context header with phone, linked client, and quick client access in `src/components/whatsapp/ConversationHeader.tsx`
- [X] T058 [US3] Wire header and attachment flows into active panel in `src/components/whatsapp/ConversationPanel.tsx`
- [X] T059 [US3] Add blocked/failed attachment event handling and safe UI messages in `src/pages/WhatsAppAtendimentoPage.tsx`
- [X] T060 [US3] Add fixture validation for inbound media and media failure paths in `supabase/functions/whatsapp-webhook/fixtures/messages.json`

**Checkpoint**: Attachment receipt/send is functional and independently testable.

---

## Phase 6: User Story 4 - Controlar responsabilidade e conclusão de atendimentos (Priority: P4)

**Goal**: Authorized users can link unmatched contacts to clients, assign conversations, change status, and audit responsibility changes.

**Independent Test**: Use an unmatched conversation, link it to an active client, assign it to an eligible user, change status, and verify queue updates, permissions, notifications, and audit events.

### Implementation for User Story 4

- [X] T061 [P] [US4] Implement client-link action with same-organization active-client validation in `src/lib/whatsappConversations.ts`
- [X] T062 [P] [US4] Implement assignment action with eligible-user validation in `src/lib/whatsappConversations.ts`
- [X] T063 [P] [US4] Implement status change action and allowed transitions in `src/lib/whatsappConversations.ts`
- [X] T064 [US4] Add backend validation for client link, assignment, and status updates in `supabase/functions/whatsapp-send-message/index.ts`
- [X] T065 [US4] Add conversation assignment history creation in `supabase/functions/_shared/whatsapp-events.ts`
- [X] T066 [US4] Add responsible/status/client link controls to conversation header or side panel in `src/components/whatsapp/ConversationHeader.tsx`
- [X] T067 [US4] Add unmatched contact linking workflow in `src/pages/WhatsAppAtendimentoPage.tsx`
- [X] T068 [US4] Add assignment and status notification handling in `src/components/app/AppLayout.tsx`
- [X] T069 [US4] Add audit event display or developer inspection helper for conversation events in `src/lib/whatsappConversations.ts`

**Checkpoint**: Operational ownership and status control work independently.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Hardening, validation, accessibility, performance, and documentation across all stories.

- [X] T070 [P] Add route-level lazy loading for WhatsApp atendimento page in `src/App.tsx`
- [X] T071 [P] Add accessibility labels, focus states, keyboard navigation, and reduced-motion checks in `src/components/whatsapp/ConversationList.tsx`
- [X] T072 [P] Add accessibility labels, focus states, keyboard navigation, and reduced-motion checks in `src/components/whatsapp/ConversationPanel.tsx`
- [X] T073 Add responsive desktop/tablet layout polish and overflow handling in `src/pages/WhatsAppAtendimentoPage.tsx`
- [X] T074 Add performance review for list rendering, memoized maps, and bounded derived state in `src/hooks/useWhatsAppConversations.ts`
- [X] T075 Add RLS/storage manual validation notes and rollback SQL notes in `supabase/migrations/20260716190002_add_whatsapp_client_chat.sql`
- [ ] T076 Run quickstart manual validation and record results in `specs/008-whatsapp-client-chat/quickstart.md`
- [ ] T077 Run targeted webhook fixture checks for inbound text, duplicate event, delivery status, and media using `supabase/functions/whatsapp-webhook/fixtures/messages.json`
- [ ] T078 Run targeted SQL/RLS checks using `supabase/tests/whatsapp_client_chat_rls.sql`
- [X] T079 Run `npm run lint` and record any required fixes against `package.json`
- [X] T080 Run `npm run test` and record any required fixes against `package.json`
- [X] T081 Run `npm run build` and record any required fixes against `package.json`
- [X] T082 Update implementation notes and known limitations in `specs/008-whatsapp-client-chat/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: No dependencies.
- **Phase 2 Foundational**: Depends on Phase 1 and blocks every user story.
- **Phase 3 US1 MVP**: Depends on Phase 2.
- **Phase 4 US2**: Depends on Phase 2; can start in parallel with US1 after foundation, but final UX benefits from US1 components.
- **Phase 5 US3**: Depends on Phase 2; can start in parallel with US1/US2 once foundational media contracts exist.
- **Phase 6 US4**: Depends on Phase 2; can start in parallel with US2 after conversation list and status concepts exist.
- **Phase 7 Polish**: Depends on completed desired user stories.

### User Story Dependencies

- **US1 (P1)**: MVP, no dependency on other stories after foundation.
- **US2 (P2)**: Independent queue/filter increment; uses the same conversation summary model as US1.
- **US3 (P3)**: Independent media increment; uses conversation/message foundations.
- **US4 (P4)**: Independent operational control increment; uses conversation foundations.

### Within Each User Story

- Data access/helpers before hooks.
- Hooks before page wiring.
- Backend validation before frontend actions that mutate protected data.
- Component shells may be built in parallel, then composed in the page.
- Contract fixtures should be validated before declaring a story complete.

---

## Parallel Opportunities

- Setup tasks T005-T008 can run in parallel.
- Foundational helper tasks T011-T014 and frontend lib tasks T018-T020 can run in parallel after T009 starts.
- US1 components T032-T035 can run in parallel after hooks/contracts are known.
- US2 filter query T041 and migration index task T042 can run in parallel.
- US3 media backend task T050 and frontend media helper task T054 can run in parallel after storage policies exist.
- US4 actions T061-T063 can run in parallel because they touch separate function paths within the same data access module and can be merged carefully.
- Polish accessibility tasks T071-T072 can run in parallel.

---

## Parallel Example: User Story 1

```text
Task: "T032 [P] [US1] Build WhatsApp-style conversation list component in src/components/whatsapp/ConversationList.tsx"
Task: "T033 [P] [US1] Build active conversation panel component in src/components/whatsapp/ConversationPanel.tsx"
Task: "T034 [P] [US1] Build message bubble component with inbound/outbound styling and delivery state in src/components/whatsapp/MessageBubble.tsx"
Task: "T035 [P] [US1] Build text composer with Enter-to-send, Shift+Enter newline, disabled sending state, and duplicate-send guard in src/components/whatsapp/MessageComposer.tsx"
```

## Parallel Example: User Story 3

```text
Task: "T050 [P] [US3] Implement inbound media metadata handling and attachment record creation in supabase/functions/whatsapp-webhook/index.ts"
Task: "T054 [P] [US3] Add attachment upload and signed access helpers in src/lib/whatsappMedia.ts"
Task: "T057 [US3] Add client/contact context header with phone, linked client, and quick client access in src/components/whatsapp/ConversationHeader.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 setup.
2. Complete Phase 2 foundation with schema, RLS, storage, Edge Function scaffolds, and core frontend data modules.
3. Complete Phase 3 US1.
4. Stop and validate:
   - open `/app/whatsapp`
   - view one conversation
   - receive one inbound text fixture
   - send one outbound text
   - confirm no duplicate sends
   - confirm realtime/list update

### Incremental Delivery

1. Deliver US1 for basic conversation read/send.
2. Add US2 for operational queue, unread indicators, filters and notifications.
3. Add US3 for attachments/media and client context.
4. Add US4 for assignment, client linking and status control.
5. Run Phase 7 validation before production release.

### Parallel Team Strategy

1. One developer owns Supabase migration/RLS/storage.
2. One developer owns Edge Functions/webhook/send/media.
3. One developer owns frontend route, components and hooks.
4. Merge at story checkpoints, not only at the final polish phase.

---

## Notes

- Keep WhatsApp credentials, verify tokens and service-role behavior out of browser-facing code.
- Backend must own deduplication even if the frontend also guards against duplicate clicks.
- Realtime events are hints; TanStack Query refetch remains the source of recovery after missed events.
- Do not expose this module to client portal or public routes in v1.
- Preserve unrelated dirty worktree changes when implementing.
