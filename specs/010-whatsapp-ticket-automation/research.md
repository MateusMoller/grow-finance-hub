# Research: WhatsApp Ticket Automation

## Decision: Extend existing WhatsApp conversation tables instead of replacing them

**Rationale**: The repository already has `whatsapp_contacts`, `whatsapp_conversations`, `whatsapp_messages`, attachments, assignments, events, notifications, media storage, webhook handling, send-message handling and realtime publication. Extending this model avoids migration churn, preserves current chat UX and keeps recent fixes for manual client linking and media handling.

**Alternatives considered**:
- Build a new `conversations/messages` subsystem: rejected because it duplicates existing WhatsApp tables and would require risky data migration.
- Store ticket context only inside `kanban_tasks.integration_payload`: rejected because it makes routing, reporting and SLA queries hard to index and audit.

## Decision: Add explicit ticket and task-message linking records

**Rationale**: A public ticket must represent the external face of a task. The current Kanban task alone does not capture protocol, external status, active context, customer visibility or SLA state. Dedicated ticket/link tables make routing by reply, protocol and context deterministic.

**Alternatives considered**:
- Use `kanban_tasks.id` as the customer protocol: rejected because UUIDs expose internal identifiers and are not user-friendly.
- Use only `integration_source` and `integration_task_id`: rejected because one task can need multiple message links, events and SLA records.

## Decision: Routing priority is deterministic and backend-owned

**Rationale**: The spec requires the priority order: quoted reply, selected ticket, protocol, active context, inference, manual triage. This affects customer data access and task integrity, so it must be enforced in webhook/Edge Function logic and persisted in audit events.

**Alternatives considered**:
- Let the frontend choose the target ticket: rejected because inbound WhatsApp events can arrive without an open UI.
- Let AI decide primary routing: rejected because permission and exact-link rules must be deterministic.

## Decision: Triage suggestions are proposals unless confidence and category are explicitly configured for automation

**Rationale**: The feature handles fiscal, accounting, labor and financial context. Human approval avoids irreversible or duplicate task creation when classification is ambiguous or the request has operational/legal risk. Automatic task/ticket creation is allowed only when classification confidence is at least 90%, preserving automation value for clear requests while keeping lower-confidence cases in triage.

**Alternatives considered**:
- Fully automatic task creation for all new messages: rejected by scope and safety requirements.
- Manual triage only: rejected because it misses the automation value of grouping and suggestion generation.
- Organization-specific first-run thresholds below 90%: rejected because v1 needs a conservative default before operational evidence exists.

## Decision: Use official WhatsApp interactive messages for customer choices

**Rationale**: Lists and buttons reduce ambiguity when customers choose company, ticket or action. They also support deterministic backend routing and create a clearer audit trail than parsing free-form replies.

**Alternatives considered**:
- Text-only commands: rejected because customers may mistype options and because multi-company/ticket selection becomes fragile.
- Frontend-only ticket selection: rejected because the customer is acting from WhatsApp, not the internal app.
- Hybrid as the primary path: deferred as fallback behavior only when provider limitations require it.

## Decision: Active ticket context expires after 24 hours by default

**Rationale**: A 24-hour default aligns with common WhatsApp customer service window expectations and limits accidental routing of stale messages to old tickets. The value remains organization-configurable.

**Alternatives considered**:
- 8 hours: rejected because it can expire during normal same-day operational delays.
- 72 hours or no automatic expiry: rejected because it increases stale-context routing risk.

## Decision: SLA and reminders are recorded as ticket/task events with scheduled jobs

**Rationale**: SLA clocks, reminders and closure need deterministic periodic evaluation independent of users opening the app. Events provide auditability and allow reporting by sector, responsible, client and period.

**Alternatives considered**:
- Calculate SLA only at render time: rejected because reminders/alerts need to be sent without a user viewing the page.
- Store only current SLA status: rejected because elapsed waiting time and reminder history must be auditable.

## Decision: Customer-visible and internal messages remain separate by mode and access policy

**Rationale**: The task chat already has internal comments and WhatsApp messages. The feature must prevent internal context, priority, audit, sector notes and internal attachments from leaking to customers, so every message/link needs an explicit visibility/relation type. Internal task attachments are private by default and require an explicit authorized release action before customer exposure.

**Alternatives considered**:
- One chat stream with UI-only filters: rejected because a UI bug could expose internal content.
- Separate unrelated modules for internal and external communication: rejected because the task needs a unified operational history.
- Make all task attachments customer-visible by default: rejected because fiscal/accounting/labor documents can be sensitive and need explicit release.

## Decision: Use paginated timelines and indexed filters for high-volume histories

**Rationale**: WhatsApp conversations and tickets can grow indefinitely. Queries must filter by organization, conversation, ticket, task, client, status, SLA and created dates. UI should load bounded pages and avoid repeated render scans.

**Alternatives considered**:
- Load all messages and tickets into the browser: rejected for performance and memory.
- Denormalize all metrics into a single table: rejected as a first step because it complicates correctness; summary views can be added later if metrics need it.

## Decision: Media and sensitive documents use existing WhatsApp media storage pattern with scoped access

**Rationale**: The project already downloads, stores and previews WhatsApp media. Ticket automation should reuse the bucket/policies and add ticket/task links, not create a second attachment pipeline.

**Alternatives considered**:
- Keep media only on the WhatsApp provider: rejected because links expire and operational audit requires preserved records.
- Make all ticket media client-downloadable by default: rejected because sensitive documents may require release rules.
