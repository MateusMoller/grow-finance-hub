# Feature Specification: Improved WhatsApp Message Flow

**Feature Branch**: `011-improve-whatsapp-flow`

**Created**: 2026-07-28

**Status**: Draft

**Input**: User description: "Create a better specification for the WhatsApp message flow, based on a more professional, clearer and client-oriented planning of the automatic conversation flow."

## Clarifications

### Session 2026-07-28

- Q: Which tasks should the client see when consulting tasks in progress? -> A: Only operational open tasks: Backlog, A Fazer, Em Andamento, Revisao, and equivalent not-completed statuses.
- Q: Should WhatsApp collect all dynamic request-type fields or only minimal task fields? -> A: WhatsApp collects only request type, title/summary, description/context, and optional attachments; dynamic form fields remain in the portal/internal app.
- Q: When should human attendance be considered outside office hours? -> A: Human attendance is available Monday to Friday until 17:00; outside that window, the client receives an after-hours message and the conversation remains queued.
- Q: Can an unlinked WhatsApp contact create a task automatically? -> A: No; task creation requires a linked client, and unlinked contacts are guided to identification or human attendance.
- Q: What should happen when an automatic WhatsApp flow message fails due to provider or Meta policy? -> A: Record an internal failure, alert the team in the chat, and stop the next automatic step until human intervention.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Client Starts a Clear Conversation (Priority: P1)

As a client contacting Grow through WhatsApp, I want to receive a polite greeting and a simple first menu so that I immediately understand whether I should speak with the team or open/consult a request.

**Why this priority**: This is the first contact point and defines whether the client can continue without confusion.

**Independent Test**: Can be fully tested by sending a new WhatsApp message from a client number and confirming that the first response includes a correct time-based greeting and a clear menu with only the primary options.

**Acceptance Scenarios**:

1. **Given** a client sends the first message of the day, **When** the system receives the message, **Then** it sends a greeting using "Bom dia", "Boa tarde", or "Boa noite" according to the current local time.
2. **Given** the contact is linked to an existing client, **When** the greeting is sent, **Then** the message addresses the client by name.
3. **Given** the contact is not linked to a client, **When** the greeting is sent, **Then** the message welcomes the sender to Grow Contabilidade without using a client name.
4. **Given** the client already received a greeting on the same day, **When** the client sends another message, **Then** the system does not repeat the greeting for that day.
5. **Given** the initial menu is shown, **When** the client reads it, **Then** the available choices are clearly separated between speaking with the team and managing requests.

---

### User Story 2 - Client Requests Human Attendance (Priority: P1)

As a client, I want to request human attendance when my need is not suitable for the automatic flow so that the internal team is notified and can continue the conversation.

**Why this priority**: Human attendance is the safest fallback for unclear or urgent client needs.

**Independent Test**: Can be fully tested by selecting the human attendance option and confirming that the conversation moves to the attendance queue, notifies the responsible internal audience, and sends the correct response to the client.

**Acceptance Scenarios**:

1. **Given** the client selects "Falar com a equipe", **When** the current local time is within office hours, **Then** the system confirms that the conversation was forwarded to the team.
2. **Given** the client selects "Falar com a equipe", **When** the current local time is after 17:00, **Then** the system explains that office hours have ended and that the team will return on the next business day or as soon as possible.
3. **Given** a conversation is forwarded to human attendance, **When** the internal team opens the WhatsApp module, **Then** the conversation appears in the attendance area with a visual unread indicator.
4. **Given** a human attendance is manually ended by an internal user, **When** the closing message is sent, **Then** the client receives an institutional farewell without attendant headers and is asked to rate the service from 1 to 10.

---

### User Story 3 - Client Manages Requests (Priority: P1)

As a client, I want to consult open tasks or create a new request through WhatsApp so that I can resolve operational needs without needing to know Grow's internal department structure.

**Why this priority**: Most client WhatsApp interactions should become trackable tasks instead of unstructured chat.

**Independent Test**: Can be tested by selecting the requests option, consulting open tasks for the linked client, creating a new task, and confirming that the task is visible internally with the collected context.

**Acceptance Scenarios**:

1. **Given** the client selects "Solicitações", **When** the second step is shown, **Then** the system offers "Consultar tarefas" and "Nova solicitação".
2. **Given** the client selects "Consultar tarefas", **When** the contact is linked to a client, **Then** only open tasks for that client are listed.
3. **Given** no open tasks exist for the linked client, **When** the client consults tasks, **Then** the system explains that no tasks were found and offers to return to the menu or end the flow.
4. **Given** open tasks exist, **When** the client consults tasks, **Then** each task is presented with ticket number, title, and status in a readable format.
5. **Given** the client selects "Nova solicitação", **When** request types are available, **Then** the system presents the available request types as selectable options.
6. **Given** the client chooses a request type, **When** the system starts collecting information, **Then** the client is asked only for the minimum information needed to create a task.
7. **Given** the client completes the required answers, **When** the task is created, **Then** the client receives a formatted ticket confirmation with ticket number, title, and responsible party.

---

### User Story 4 - Client Continues or Ends the Flow (Priority: P2)

As a client, I want every flow ending to offer the same clear next choices so that I can either return to the main menu or finish the conversation.

**Why this priority**: Consistent endings reduce confusion and prevent dead ends.

**Independent Test**: Can be tested by completing each path and confirming that the final prompt always offers the same continuation choices.

**Acceptance Scenarios**:

1. **Given** a task consultation finishes, **When** the system sends the final prompt, **Then** it offers "Voltar ao menu" and "Encerrar".
2. **Given** a new task is created, **When** the confirmation is sent, **Then** the system offers "Voltar ao menu" and "Encerrar".
3. **Given** the client cancels a task creation flow, **When** cancellation is confirmed, **Then** the system offers a route back to the main menu.
4. **Given** the client chooses to end the automatic flow, **When** the system confirms the end, **Then** no additional automatic menu is sent unless the client starts again.

---

### User Story 5 - Internal Team Receives Useful Context (Priority: P2)

As an internal user, I want WhatsApp-created tasks to include the selected request type, client, original messages, and attachments so that I can act without asking the client to repeat information.

**Why this priority**: The value of the flow depends on converting WhatsApp conversation into actionable tasks.

**Independent Test**: Can be tested by creating a request from WhatsApp with text and attachments, then opening the generated internal task and checking whether the required context is present.

**Acceptance Scenarios**:

1. **Given** a task is created from WhatsApp, **When** the internal user opens it, **Then** the task includes the client, request type, title, description, ticket number, source channel, and creation time.
2. **Given** the client sent attachments during the task creation flow, **When** the task is created, **Then** the attachments are available in the task context.
3. **Given** the client sent multiple text messages during the task creation flow, **When** the task is created, **Then** the selected or collected messages are preserved as context.
4. **Given** a request type maps to a responsible sector, **When** the task is created, **Then** the task is assigned to that sector automatically.

### Edge Cases

- If the sender is not linked to a client, consultation of tasks must explain that a client link is required and offer human attendance or return to menu.
- If the sender is not linked to a client, new task creation must not proceed automatically; the system must request client identification or route the sender to human attendance.
- If the sender writes free text instead of pressing a button, the system must recognize common intents such as "menu", "atendimento", "solicitações", "consultar tarefas", "nova tarefa", "cancelar", and "encerrar".
- If the selected request type becomes inactive before the client completes the flow, the system must ask the client to choose again from active request types.
- If a flow expires before completion, the system must explain that the previous flow expired and offer the main menu.
- If the client sends media while the system expects text, the system must preserve the media and ask for the missing text when text is required.
- If the outbound message cannot be delivered due to WhatsApp policy restrictions, the conversation must show a clear internal failure state without misleading the client-facing workflow history.
- If an automatic flow message fails to deliver, the system must not continue the next automatic step as if the client had received it.
- If there are more open tasks than can comfortably fit in one response, the system must provide a bounded list and indicate that more tasks are available through internal attendance.
- If a client asks for human attendance outside office hours, the conversation must still be queued internally even though the response states that the office is closed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST send a time-appropriate greeting before the first automatic menu of the day for each conversation.
- **FR-002**: The system MUST avoid sending more than one daily greeting per conversation per local calendar day.
- **FR-003**: The greeting MUST use the linked client name when a reliable client link exists.
- **FR-004**: The greeting MUST use a generic Grow Contabilidade welcome message when no reliable client link exists.
- **FR-005**: The main menu MUST present only two primary choices: speaking with the team and managing requests.
- **FR-006**: The human attendance option MUST move the conversation to an internal attendance queue and generate a visible internal notification.
- **FR-007**: The human attendance response MUST be different inside and outside office hours.
- **FR-008**: Human attendance office hours MUST be considered Monday to Friday until 17:00 local time for the initial version.
- **FR-009**: The requests menu MUST allow clients to consult open tasks or start a new request.
- **FR-010**: Task consultation MUST return only operational open tasks related to the linked client, including Backlog, A Fazer, Em Andamento, Revisao, and equivalent not-completed statuses.
- **FR-011**: Task consultation MUST not expose tasks from other clients or unrelated conversations.
- **FR-012**: Task consultation MUST exclude completed and archived tasks from the client-facing WhatsApp list.
- **FR-013**: Each listed task MUST include a ticket number, title, and status.
- **FR-014**: After task consultation, the system MUST offer consistent options to return to the main menu or end the flow.
- **FR-015**: New request creation MUST prioritize request types over asking the client to choose an internal sector.
- **FR-016**: Request types MUST be active, user-manageable business options such as "Nota fiscal", "Admissão", and "Demissão".
- **FR-017**: Each request type MUST be able to define a default responsible sector.
- **FR-018**: If a generic request type is selected, it MUST not automatically belong to Societário unless explicitly configured that way.
- **FR-019**: New request creation MUST collect only the minimum required information: request type, task title or summary, description/context, and optional attachments.
- **FR-020**: The system MUST create an internal task and customer ticket after the client provides the required information.
- **FR-021**: The ticket confirmation MUST include ticket number, task title, and responsible party.
- **FR-022**: The ticket confirmation MUST be followed by options to return to the menu or end the flow.
- **FR-023**: All automatic messages MUST use professional Portuguese with correct accents and no corrupted characters.
- **FR-024**: Automatic flow messages MUST be institutional unless explicitly sent by an internal attendant.
- **FR-025**: Messages sent by internal attendants MUST identify the attendant name and sector when they are part of active human service.
- **FR-026**: Manual attendance closing MUST send an institutional farewell asking the client to rate the service from 1 to 10.
- **FR-027**: The system MUST preserve relevant WhatsApp messages and attachments as context for tasks created through the flow.
- **FR-028**: The system MUST support canceling an in-progress task creation flow.
- **FR-029**: The system MUST support restarting the main menu through common text commands.
- **FR-030**: The system MUST record relevant events for greeting, menu delivery, option selection, task creation, human attendance request, cancellation, delivery failure, and flow end.
- **FR-031**: The system MUST not send misleading success messages internally when a client-facing WhatsApp message failed to deliver.
- **FR-032**: Dynamic request-type form fields MUST NOT be collected through WhatsApp in this version; those fields remain available only in the portal or internal app.
- **FR-033**: Human attendance requests outside office hours, including weekends, MUST remain queued internally after the client receives the after-hours response.
- **FR-034**: New request creation through WhatsApp MUST require a reliable linked client before creating an internal task.
- **FR-035**: If no reliable client link exists, the system MUST not create a task automatically and MUST guide the sender to client identification or human attendance.
- **FR-036**: When an automatic WhatsApp flow message fails due to provider or Meta policy, the system MUST record an internal failure and show a visible alert to the team in the conversation.
- **FR-037**: After an automatic flow message delivery failure, the system MUST stop advancing the automatic flow until an internal user intervenes or a valid retry path is explicitly triggered.

### Security, Access & Tenant Requirements *(mandatory when data/auth is affected)*

- **SEC-001**: Affected surfaces include the internal app, client-facing WhatsApp conversation, operational task records, automation/webhook processing, media attachments, and external WhatsApp messaging integration.
- **SEC-002**: Clients may only interact through WhatsApp messages; internal users may view and manage conversations according to their module and sector permissions.
- **SEC-003**: Client task consultation and task creation MUST remain bounded to the organization and linked client associated with the WhatsApp contact.
- **SEC-004**: Sensitive messaging credentials and privileged sending operations MUST remain unavailable to client-side users.
- **SEC-005**: Audit records MUST be kept for all automated decisions that affect routing, task creation, attendance queue status, and delivery failures.
- **SEC-006**: Attachments received by WhatsApp MUST follow the same access boundaries as the related conversation and task.
- **SEC-007**: Internal users MUST not gain access to tasks outside their permitted sector through WhatsApp-generated task lists.

### Scalability & Performance Requirements *(mandatory for high-volume flows)*

- **PERF-001**: The flow must support high message volume without loading the full conversation history for every automatic decision.
- **PERF-002**: Task consultation must use bounded results, filtered by organization, client, and open statuses.
- **PERF-003**: Message history needed for task context must be limited to the active flow or explicitly selected context, not the entire conversation.
- **PERF-004**: Automatic responses should be visible to the internal user within 5 seconds for at least 95% of routine inbound messages under normal provider conditions.
- **PERF-005**: The client should be able to reach the first actionable menu in no more than two messages after initiating contact.

### Key Entities *(include if feature involves data)*

- **WhatsApp Conversation**: Represents an ongoing contact thread with a sender, linked client, status, unread count, provider identity, and current routing state.
- **WhatsApp Contact**: Represents the phone number and identity used to match a sender to an existing client.
- **Automatic Flow Session**: Represents an in-progress guided flow, including selected option, current step, expiration, collected answers, and source messages.
- **Request Type**: Represents a business-defined solicitation option shown to clients, with title, description, active status, ordering, and default responsible sector.
- **Customer Ticket**: Represents the client-facing tracking record generated from WhatsApp or linked to an existing task.
- **Internal Task**: Represents the operational work item that the Grow team will execute and track.
- **Conversation Event**: Represents an audit record of automatic decisions, user choices, delivery status, and task/ticket actions.
- **Conversation Attachment**: Represents media or files sent through WhatsApp and associated with a conversation, flow, task, or ticket.

### Data Classification *(include if feature involves data)*

- **Public**: No public unauthenticated website data is included.
- **Internal**: Conversation queues, task routing, audit events, internal status, internal notes, and attendance assignment.
- **Client Portal**: Tasks and tickets that may later be visible to the linked client according to portal rules.
- **Sensitive/Regulated**: Client identity, phone numbers, business messages, attachments, fiscal/labor/accounting context, WhatsApp provider identifiers, and operational audit history.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of clients who start the flow reach either human attendance, task consultation, or new task creation without needing free-text correction.
- **SC-002**: At least 95% of first daily interactions receive no more than one greeting per conversation per local day.
- **SC-003**: A client can start a new task through WhatsApp in 4 or fewer guided steps after selecting "Nova solicitação".
- **SC-004**: A client can consult open tasks in 2 or fewer guided steps after selecting "Solicitações".
- **SC-005**: 100% of task consultation results are scoped to the linked client and do not include tasks from other clients.
- **SC-006**: 100% of generated ticket confirmations include ticket number, title, and responsible party.
- **SC-007**: All visible automated WhatsApp texts pass a Portuguese review with correct accents and no corrupted encoding.
- **SC-008**: At least 95% of routine inbound messages show the corresponding automatic action or internal notification within 5 seconds under normal provider availability.
- **SC-009**: At least 80% of WhatsApp-created tasks include enough description or attachment context for the internal team to begin work without asking the client to repeat the initial request.
- **SC-010**: Human attendance requests outside office hours are still queued internally 100% of the time.

## Assumptions

- The first version will keep a fixed business flow rather than a fully visual flow builder.
- Human attendance is available Monday to Friday until 17:00 local Sao Paulo time; start time and holiday calendar can be refined later.
- The main menu will remain intentionally short to reduce client confusion.
- Request types are configured internally and can map to sectors without exposing internal sector complexity to the client.
- If a contact is not linked to a client, the system will not list or create tasks automatically and will guide the sender to client identification or human attendance.
- WhatsApp provider limitations such as the 24-hour service window, template approval, country restrictions, and allowed recipient rules remain external constraints.
- Automatic flow delivery failures are treated as operational blockers, not as successful client-facing steps.
- Existing internal task permission rules continue to define who can view and act on generated tasks.
