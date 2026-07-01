# Research: Obligation Delivery Flow

## Decision: Improve The Existing Native Obligations Module In Place

**Rationale**: The repository already contains `obligation_templates`, `client_obligation_profiles`, `obligation_instances`, `document_inbox_items`, `obligation_instance_files`, `expected_document_reference_files`, `document_ingestion_jobs`, `grow-obligations-module`, `obligation-document-processor`, and `GrowObligationsWorkspace.tsx`. Replacing them would create duplicate operational concepts and migration risk. The feature goal is reliability and completion, not a new module.

**Alternatives considered**:

- Build a new delivery service from scratch: rejected because it would split data and workflows.
- Keep all changes frontend-only: rejected because completion, email sending, matching, and deduplication are sensitive backend rules.

## Decision: Human-Confirmed Successful Email Delivery Is The Completion Boundary

**Rationale**: The current processor can attach a document and move an obligation instance to `concluida` before email delivery succeeds. The clarified spec requires the flow to finish only after an authorized user explicitly confirms the send action and the client email succeeds. Therefore, matched documents may move an item to "ready to send" or equivalent, but the task/instance must close only after the human-confirmed send attempt succeeds.

**Alternatives considered**:

- Complete on document match and record email failure separately: rejected because operations would show false completion.
- Require manual closure after email success: rejected for the happy path because the system can close safely when provider success is recorded.
- Auto-send after high-confidence match: rejected because guide delivery is sensitive and must have explicit human confirmation.

## Decision: Add Durable Delivery Attempt State

**Rationale**: Existing event rows can record messages, but retry, duplicate prevention, idempotency, provider ids, and audit review need a durable delivery attempt concept. This can be implemented as a new table or as a compatible extension to existing event/file/inbox records, but tasks should rely on a durable success record rather than free-text comments.

**Alternatives considered**:

- Store only `completion_email_sent` events: rejected because querying retry state and duplicate send warnings becomes fragile.
- Store provider responses only in document metadata: rejected because metadata is too loose for operational filtering.

## Decision: Verified Grow Sender With User Reply-To/Audit Identity

**Rationale**: The email provider may reject arbitrary user domains. The clarified behavior is to send from a verified Grow address while using the registered email of the user who confirms sending as reply-to, displayed sender context, and audit identity. This preserves deliverability and accountability.

**Alternatives considered**:

- Use the user's email as `From` for every delivery: rejected because unverified domains can fail provider validation.
- Use uploader as sender: rejected because upload and final send may be performed by different users.

## Decision: Primary Client Email Is The Default Recipient

**Rationale**: The clarified first release uses the client's primary registered email by default and allows review/edit before confirmation. This keeps the flow predictable and avoids premature multi-contact routing complexity while preserving a manual correction path.

**Alternatives considered**:

- Select a contact on every send: deferred because it increases operational friction for the first reliable flow.
- Send to all active client emails: rejected because it can expose sensitive documents to unintended contacts.
- Put secondary contacts in copy by default: rejected until contact roles and opt-in rules are explicitly governed.

## Decision: Historical Completions Without Email Evidence Become Review Flags

**Rationale**: Reopening old completed obligations in bulk could disrupt historical operations and create noise. The clarified behavior preserves historical completion status and marks records without email-sent evidence for delivery review/audit.

**Alternatives considered**:

- Reopen all historical completed records without email evidence: rejected because it can create large false backlogs.
- Ignore historical records completely: rejected because missing evidence still needs audit visibility.

## Decision: Templates Are Extraction References, Guides Are Delivery Attachments

**Rationale**: Expected document templates and reference files are used to identify or validate uploaded guides. They should never be sent to the client. The guide or final client document uploaded through Central de Documentos is the sendable attachment.

**Alternatives considered**:

- Reuse reference files as outgoing attachments: rejected because they are internal templates.
- Require no templates: rejected because existing smart matching depends on references and aliases.

## Decision: Manual Review Is Required For Ambiguous Matching

**Rationale**: Low-confidence or conflicting matches can send fiscal/labor documents to the wrong client. The current system already has `pending_review`, `review_required`, confidence scores, and manual resolution actions; the plan keeps and sharpens those gates.

**Alternatives considered**:

- Always auto-link the most likely match: rejected due client data risk.
- Block all automated matching: rejected because it would remove the intended robot value.

## Decision: Task Generation Remains Idempotent And Backend-Owned

**Rationale**: `obligation_instances` already has a uniqueness rule for client/template/competence. Task/Kanban generation should follow equivalent idempotency so repeated generation does not duplicate work. Backend ownership prevents the UI from creating inconsistent tasks.

**Alternatives considered**:

- Create tasks only from the browser: rejected because retries, robots, and automations also need consistency.
- Allow duplicates then merge in UI: rejected because it hides operational data errors.

## Decision: Use Server Filtering For Queues And Lightweight UI Derivations

**Rationale**: The feature affects high-volume queues. The UI should request filtered/paginated views, while local code can use `Map`/`Set` for page-level matching and option building. This follows the project constitution and avoids repeated scans as volume grows.

**Alternatives considered**:

- Load every obligation/document/task row into the browser: rejected for scale and security.
- Introduce a new state library: rejected because TanStack Query already covers remote state.
