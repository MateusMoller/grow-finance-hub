# Feature Specification: Obligation Delivery Flow

**Feature Branch**: `005-obligation-delivery-flow`

**Created**: 2026-06-30

**Status**: Draft

**Input**: User description: "ajuste o fluxo de envio das obrigacoes, entendendo como ela deveria funcionar, o objetivo da spec e fazer o envio delas funcionar para podermos utilizar para concluir o envio para os clientes. De forma geral devemos ter uma obrigacao cadastrada, que vai conter informacoes do que se trata, datas de conclusao, documentos esperados para o envio (que sao templates apenas para extrair as informacoes), e mensagens padrao para o envio das guias para o cliente, encaminhando assim a guia anexada e a mensagem padrao. As obrigacoes devem criar automaticamente tarefas para acompanhar melhor no operacional, e quando foi concluido o envio a tarefa se encerre. Para ser feita a conclusao e utilizado o campo de Central de Documentos para anexar as guias que o robo da Grow ira fazer a leitura e direcionar para a obrigacao, cliente, e competencia correta, finalizando o fluxo apenas quando for disparado o email para o cliente, utilizando o provedor de email transacional ja integrado; o email enviado deve usar o email cadastrado do usuario que fez o envio."

## Clarifications

### Session 2026-06-30

- This feature must improve, adjust, optimize, and make the existing obligation delivery capabilities work reliably. It must not be treated as a full rebuild when existing obligation catalog, task, document upload, document processing, and email delivery pieces can be reused safely.
- Q: How should the sender identity work when the user's registered email domain is not accepted by the email provider? -> A: Use a verified Grow email as `From`, while `Reply-To`, displayed sender context, and audit records use the registered email of the user who performed the send action.
- Q: Should the system send the client email automatically after a high-confidence robot match? -> A: Always require explicit human confirmation before sending the email to the client.
- Q: How should historical completed obligations without email-sent evidence be handled? -> A: Preserve the historical status and mark those records as requiring delivery review/audit instead of reopening them automatically.
- Q: Which client email should be used when sending obligation guides? -> A: Use the client's primary registered email as the default recipient, allowing review/edit before the authorized user confirms sending.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configure Obligation For Delivery (Priority: P1)

An internal user can use the existing obligation catalog to register or edit an obligation with its business description, sector, deadlines, expected documents, extraction templates, default client message, and delivery rules so that the operation has a repeatable workflow for each competence.

**Why this priority**: The obligation definition is the source of truth for tasks, document matching, guide delivery, and client communication. Without a complete obligation, the downstream flow cannot be trusted.

**Independent Test**: Can be tested by creating an obligation with expected documents and a default delivery message, then confirming that future competencies and tasks can be generated from that configuration.

**Acceptance Scenarios**:

1. **Given** an internal user creates a new obligation, **When** they save required details, deadlines, expected documents, and the default message, **Then** the obligation becomes available for operational tracking and document delivery.
2. **Given** an obligation requires one or more expected documents, **When** the user marks those documents as extraction templates, **Then** the system treats them as matching guidance and does not send those templates to the client.
3. **Given** an obligation has a default message with placeholders, **When** a delivery is prepared, **Then** the message can be resolved with the selected client, obligation, competence, deadline, and sender context.

---

### User Story 2 - Generate Operational Tasks Automatically (Priority: P2)

The system uses the existing task workflow to create operational tasks from active obligations so the team can track each client and competence before the guide is delivered.

**Why this priority**: Tasks are the operational control layer. They prevent obligations from relying only on document upload events and give the team visibility before delivery.

**Independent Test**: Can be tested by activating an obligation for a client and competence, then confirming that the expected task appears in the correct operational queue with the expected due dates and status.

**Acceptance Scenarios**:

1. **Given** an active obligation applies to a client and competence, **When** the competence cycle is generated, **Then** the system creates the corresponding operational task with obligation, client, competence, sector, deadline, and status.
2. **Given** a task already exists for the same obligation, client, and competence, **When** the generation runs again, **Then** the system does not create a duplicate task.
3. **Given** the guide has not yet been sent to the client, **When** the user reviews the task, **Then** the task remains open or pending according to its current delivery stage.

---

### User Story 3 - Upload Guides In Central Documents (Priority: P3)

An internal user uploads guides or client documents through the existing Central de Documentos, and the Grow document reader identifies the obligation, client, and competence to route each file to the right operational item.

**Why this priority**: The central upload area is the entry point for actual guides. Reliable routing is required before the system can send anything to clients.

**Independent Test**: Can be tested by uploading a valid guide for a known client, obligation, and competence, then confirming that the document is attached to the correct pending delivery and task.

**Acceptance Scenarios**:

1. **Given** a guide contains enough information to identify client, obligation, and competence, **When** the file is uploaded in Central de Documentos, **Then** the system routes it to the matching obligation delivery record and related task.
2. **Given** the document reader cannot confidently identify one or more required fields, **When** processing finishes, **Then** the document enters a review state and is not sent to the client automatically.
3. **Given** more than one possible match exists, **When** processing finishes, **Then** the system requires an internal user to confirm the correct client, obligation, and competence before delivery.

---

### User Story 4 - Send Guide To Client And Close Task (Priority: P4)

An internal user sends the matched guide to the client using the obligation's default message and the existing email delivery integration, and the operational task is closed only after the client email is successfully sent.

**Why this priority**: The business value is completed only when the client receives the guide. Marking a task complete before sending creates false operational confidence.

**Independent Test**: Can be tested by uploading a matched guide, reviewing the delivery message, sending it to the client, and verifying that the task closes only after successful delivery.

**Acceptance Scenarios**:

1. **Given** a guide is matched to a client, obligation, and competence, **When** an authorized user explicitly reviews and confirms the delivery, **Then** the system sends the guide as an attachment with the resolved default message.
2. **Given** the delivery is sent successfully, **When** the system records the delivery result, **Then** the related task is marked complete and the delivery history shows the sender, client, obligation, competence, document, message, and timestamp.
3. **Given** the email cannot be sent, **When** the delivery attempt fails, **Then** the task remains open, the document remains available for retry, and the user can see a clear failure reason.
4. **Given** a user sends a guide, **When** the client receives the email, **Then** the email uses a verified Grow sender address and preserves the sending user's registered email as reply-to, displayed sender context, and audit identity.

---

### User Story 5 - Audit And Reprocess Delivery Problems (Priority: P5)

Admins and authorized collaborators can review failed, pending, sent, and manually corrected deliveries to understand what happened and reprocess items safely.

**Why this priority**: Obligation delivery involves client-facing fiscal and operational documents; failures must be visible, auditable, and recoverable.

**Independent Test**: Can be tested by forcing a routing failure or delivery failure, correcting the data, retrying the flow, and confirming the audit trail preserves the original and corrected events.

**Acceptance Scenarios**:

1. **Given** a document fails matching, **When** a user corrects the client, obligation, or competence, **Then** the correction is recorded with actor, timestamp, previous value, and new value.
2. **Given** an email delivery fails, **When** a user retries after resolving the issue, **Then** the retry creates a new delivery attempt without erasing the previous failure.
3. **Given** an obligation delivery has already been sent successfully for a client and competence, **When** a user attempts to send the same guide again, **Then** the system warns about the prior delivery and requires explicit confirmation.

### Edge Cases

- If the obligation is inactive, missing required delivery configuration, or not applicable to the selected client, the system must prevent automatic task generation and explain the missing condition.
- If a client has no valid delivery email, the guide must not be sent and the related task must remain open with a clear action required.
- If a client has more than one possible contact email, the system must default to the client's primary registered email and allow the authorized user to review or edit the recipient before sending.
- If the sender user has no registered email, the send action must be blocked until the user profile is corrected.
- If a guide is uploaded before the operational task exists, the system must either create or associate the correct pending operational item without losing the uploaded document.
- If multiple documents are expected for the same obligation, client, and competence, delivery must wait until all documents required for that delivery are present or explicitly waived by an authorized user.
- If a document is uploaded twice, the system must prevent accidental duplicate delivery while preserving traceability of the duplicate upload.
- If the default message cannot resolve a placeholder, the delivery must remain in review state until the message is corrected or the placeholder is removed.
- If a user changes an obligation's default message after a delivery has been sent, historical deliveries must keep the message that was actually sent.
- If a delivery is prepared by one user and sent by another, the reply-to, displayed sender context, and audit identity must belong to the user who performed the send action.
- If the document reader produces low confidence or conflicting results, the system must require manual confirmation before any email can be sent.
- If the document reader produces a high-confidence match and all delivery fields are valid, the system may prepare the delivery but must still wait for an authorized user's explicit send confirmation.
- If an existing obligation was already marked complete before this corrected flow and has no evidence of client email delivery, the system must preserve the historical completion status and flag it for delivery review/audit.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-000**: The system MUST treat this feature as an improvement of the existing obligation catalog, task workflow, Central de Documentos, document processing, and email delivery flow, reusing existing valid records and user-facing surfaces wherever they satisfy the required behavior.
- **FR-001**: The system MUST allow authorized internal users to create and edit obligation records with name, description, sector, applicability, deadlines, expected documents, extraction templates, and default client messages.
- **FR-002**: The system MUST distinguish between extraction templates and client-sendable guide files so templates are never treated as attachments for client delivery.
- **FR-003**: The system MUST allow each obligation to define one or more expected documents required before a delivery can be completed.
- **FR-004**: The system MUST allow each obligation to define a default message for client delivery, including supported placeholders for client, obligation, competence, deadline, sender, and document context.
- **FR-005**: The system MUST validate required obligation delivery configuration before an obligation can generate operational tasks.
- **FR-006**: The system MUST automatically create operational tasks for active obligation, client, and competence combinations that require tracking.
- **FR-007**: The system MUST prevent duplicate operational tasks for the same obligation, client, and competence.
- **FR-008**: The system MUST keep generated tasks open until the related delivery is successfully sent to the client or explicitly cancelled by an authorized user.
- **FR-009**: The system MUST allow authorized internal users to upload guide files through Central de Documentos for obligation delivery processing.
- **FR-010**: The system MUST route uploaded guides to the matching obligation, client, and competence when the document content provides enough confidence.
- **FR-011**: The system MUST place documents in manual review when matching is missing, ambiguous, low-confidence, or conflicts with existing data.
- **FR-012**: The system MUST allow authorized users to manually correct or confirm client, obligation, competence, and document association before delivery.
- **FR-013**: The system MUST block client delivery until all required documents for that delivery are present, confirmed, or explicitly waived by an authorized user.
- **FR-014**: The system MUST prepare a client delivery using the matched guide attachment and the obligation's resolved default message.
- **FR-015**: The system MUST send the client delivery from a verified Grow sender address while using the registered email of the user who performed the send action as reply-to, displayed sender context, and audit identity.
- **FR-016**: The system MUST block sending when the sender user does not have a valid registered email.
- **FR-017**: The system MUST default the delivery recipient to the client's primary registered email and MUST block sending when no valid primary or reviewed recipient email is available.
- **FR-018**: The system MUST mark the related operational task complete only after an authorized user explicitly confirms the send action and the client delivery is successfully sent.
- **FR-019**: The system MUST keep the task open and show the failure reason when email delivery fails.
- **FR-020**: The system MUST record every delivery attempt, including verified sender address, acting user's registered email, recipient, obligation, client, competence, documents, message content, result, timestamp, and failure reason when applicable.
- **FR-021**: The system MUST preserve historical delivery records even if the obligation template, message, client email, or sender profile changes later.
- **FR-022**: The system MUST warn users before sending a duplicate successful delivery for the same obligation, client, competence, and document set.
- **FR-023**: The system MUST allow failed or reviewed deliveries to be retried without erasing previous attempts.
- **FR-024**: The system MUST expose clear statuses for each obligation delivery, at minimum: pending task, awaiting document, awaiting review, ready to send, sending, sent, failed, cancelled.
- **FR-025**: The system MUST provide list and detail views that let users filter obligation deliveries by status, obligation, client, competence, sector, deadline, and sender.
- **FR-026**: The system MUST preserve existing obligation, document, task, and delivery data during the improvement and must provide a safe path for existing records to continue through the corrected flow.
- **FR-027**: The system MUST identify and close functional gaps in the current flow before introducing replacement screens or duplicate operational concepts.
- **FR-028**: The system MUST keep existing user workflows recognizable unless a change is required to prevent failure, ambiguity, duplicate work, or incorrect client delivery.
- **FR-029**: The system MUST preserve historical completed obligation statuses that lack email-sent evidence and MUST mark those records as requiring delivery review/audit rather than automatically reopening them.

### Security, Access & Tenant Requirements *(mandatory when data/auth is affected)*

- **SEC-001**: Affected surfaces include the internal app, obligation catalog, task workflows, Central de Documentos, document processing, client email delivery, storage/download actions, and audit records.
- **SEC-002**: Only authorized internal users may create or edit obligations, upload guides for processing, correct document matches, send client deliveries, retry failed deliveries, or cancel operational tasks.
- **SEC-003**: Client users must not access internal obligation configuration, internal matching decisions, operational task queues, or cross-client delivery history.
- **SEC-004**: Every read, upload, matching decision, correction, send action, and task update must remain scoped to the current organization and the selected client.
- **SEC-005**: Sensitive provider credentials and privileged send operations must remain outside client-side UI execution.
- **SEC-006**: Audit records must identify actor, organization, client, obligation, competence, affected document, changed fields, delivery result, and timestamp.
- **SEC-007**: Uploaded guides and extracted information must be treated as sensitive client documents and must not be exposed to unauthorized users or unrelated clients.
- **SEC-008**: Sending a guide must require an authenticated user with permission to act on the selected obligation and client.

### Scalability & Performance Requirements *(mandatory for high-volume flows)*

- **PERF-001**: The workflow must support at least 5,000 active clients, 500 obligation definitions, and 100,000 obligation delivery records per organization without requiring users to scan unrelated records manually.
- **PERF-002**: Operational lists must support filtering by status, obligation, client, competence, sector, deadline, and sender before users interact with individual records.
- **PERF-003**: Upload processing must be suitable for batch uploads of at least 100 guide files in one operational action, with each file receiving an individual status.
- **PERF-004**: For normal-sized guide files, users must see an initial processing status within 10 seconds of upload.
- **PERF-005**: The send-and-close flow must complete or show an actionable failure state within 30 seconds for 95% of single-guide deliveries under normal operating conditions.
- **PERF-006**: Task generation must be idempotent and safe to rerun for the same competence without creating duplicate work items.

### Key Entities *(include if feature involves data)*

- **Obligation**: A reusable business definition describing what must be delivered, who owns it operationally, relevant deadlines, applicability, expected documents, extraction templates, and default client communication.
- **Expected Document**: A document requirement attached to an obligation; it describes what must be present before delivery and may include a template used only for extraction and matching guidance.
- **Competence**: The period or reference month/year for which a client obligation is being tracked and delivered.
- **Operational Task**: A work item generated from an obligation, client, and competence to track preparation, document processing, sending, and completion.
- **Central Document Upload**: A guide or supporting file uploaded for processing and matching to a client, obligation, and competence.
- **Document Match**: The system or user-confirmed association between an uploaded document and its client, obligation, competence, and expected document type.
- **Obligation Delivery**: The client-facing delivery record that gathers matched documents, resolved message content, sender identity, status, attempts, and final result.
- **Delivery Attempt**: A single attempt to send documents and message to a client, with success or failure details.
- **Sender Identity**: The authenticated internal user who performs the final send action; their registered email is used for reply-to, displayed sender context, and audit identity while the email is sent from a verified Grow sender address.
- **Delivery Audit Entry**: A record of matching, correction, sending, retry, cancellation, and task-completion events.

### Data Classification *(include if feature involves data)*

- **Public**: No public-site data is introduced by this feature.
- **Internal**: Obligation configuration, operational tasks, processing statuses, matching decisions, retries, and delivery audit records.
- **Client Portal**: Client-visible delivery history or documents only if an existing client-facing area is explicitly configured to show them.
- **Sensitive/Regulated**: Client fiscal, labor, financial, identity, and operational guide documents; extracted document information; client email addresses; sender email identity; delivery messages and attachments.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Authorized users can configure an obligation with deadlines, expected documents, extraction templates, and default message in under 5 minutes for 90% of tested obligations.
- **SC-002**: Task generation creates exactly one open task per active obligation, client, and competence combination in 100% of acceptance tests.
- **SC-003**: At least 95% of valid uploaded guides with complete identifying information are routed to the correct obligation, client, and competence without manual correction during acceptance testing.
- **SC-004**: 100% of ambiguous, low-confidence, or conflicting document matches enter manual review and are not sent automatically.
- **SC-005**: 100% of completed operational tasks have a successful client delivery record attached before being marked complete.
- **SC-006**: 100% of email delivery failures keep the related task open and display an actionable failure reason during acceptance testing.
- **SC-007**: Users can retry a failed delivery or correct a reviewed document without re-uploading the same file in 95% of tested cases.
- **SC-008**: Duplicate successful delivery attempts for the same obligation, client, competence, and document set are warned or blocked in 100% of tested cases.
- **SC-009**: Batch uploads of 100 guide files show per-file processing status within 10 seconds for at least 95 files under normal operating conditions.
- **SC-010**: Delivery audit review can reconstruct who uploaded, confirmed, sent, retried, or cancelled a delivery in 100% of sampled completed and failed records.
- **SC-011**: Existing valid obligations, uploaded documents, and open operational tasks can continue through the improved flow without manual recreation in 95% of sampled records.
- **SC-012**: The corrected flow reduces obligation delivery failures caused by missing routing, missing sender email, duplicate task creation, or premature task closure by at least 80% within 30 days of release.
- **SC-013**: 100% of sampled historical completed obligations without email-sent evidence are preserved and visibly classified for delivery review/audit after reconciliation.

## Assumptions

- The existing authentication and user profile system remains the source for the sender user's registered email.
- The existing transactional email integration remains available for sending client-facing emails and attachments.
- The visible sender context, reply-to, and audit identity must be based on the user who clicks or confirms the final send action, not necessarily the user who uploaded or reviewed the document.
- Extraction templates are internal matching aids and are not intended to be sent to clients.
- The first release focuses on email delivery; other channels such as WhatsApp can remain future enhancements unless already supported by existing flows.
- Client delivery email addresses already exist in client records or contact records; the first release defaults to the client's primary registered email and validates any reviewed recipient before sending.
- The Grow document reader may be automated, semi-automated, or manually confirmed, but the business flow requires a reliable match and explicit human send confirmation before client delivery.
- Existing task and obligation modules remain the operational surfaces; this feature standardizes their connection to document processing and client delivery.
- Existing screens, records, and integrations should be improved in place when they can support the required behavior, instead of creating parallel flows that would split the operation.
- Data migration or reconciliation may be needed for existing obligations, tasks, documents, or delivery attempts that were created before the flow was fully reliable.
- Historical completion status is treated as an operational record; lack of email evidence creates a review flag, not automatic task reopening.
