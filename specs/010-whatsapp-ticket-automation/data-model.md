# Data Model: WhatsApp Ticket Automation

## Existing Entities To Reuse

### Client

Represents the company/customer already registered in the system.

Key attributes used by this feature: organization, name, status, phone/contact fields, active/inactive state, portal links and client data phone fields.

Relationships:
- Has many authorized contacts through existing client/contact/portal links.
- Has many WhatsApp contacts/conversations.
- Has many tickets and Kanban tasks.

Validation:
- Only active and authorized clients can be exposed to a contact.
- Manual WhatsApp client links must not be overwritten by weaker automatic matches.

### Kanban Task

Internal operational unit. A ticket is the customer-facing representation of one principal task.

Key attributes used by this feature: organization, title, description/context, client, sector, assignee, priority, status, due date, integration source/key and audit metadata.

Relationships:
- Has one principal customer ticket for the WhatsApp ticket flow.
- Has many task-message links and internal comments.
- May have related tasks, but related tasks do not block each other.

Validation:
- A task created from ticket automation must include customer context and origin message.
- A task without assignee is allowed when sector/responsible user is not determined yet.

### WhatsApp Contact

Represents a normalized phone/contact identity in WhatsApp.

Key attributes: organization, phone number, display/profile name, linked client, match status, link source, active/block flags.

Relationships:
- Belongs to organization.
- May link to one active client.
- Has conversations and tickets through messages/conversations.

Validation:
- Phone normalization must be deterministic.
- Manual client link has priority over automatic linking.
- Unknown contacts can create intake records but cannot see customer data.

### WhatsApp Conversation

Represents a general WhatsApp thread for a contact. It may contain messages for multiple tickets.

Key attributes: organization, contact, client, status, active window, unread count, assigned user/team, last message.

Relationships:
- Has many messages, attachments, events and notifications.
- Can have one active context at a time per contact/client.
- Sends official WhatsApp interactive messages for company, ticket and action selection when routing requires customer choice.

Validation:
- Conversation status must not be used as the source of truth for operational ticket status.
- Customer messages without resolved ticket route go to triage/intake.

### WhatsApp Message

Represents a single inbound or outbound message.

Key attributes: organization, conversation, contact, client, direction, provider id, client message id, message type, body/preview, delivery status, failure reason, reply-to provider id, timestamps and metadata.

Relationships:
- May have attachments.
- May link to a ticket/task through task-message link.
- May originate a task suggestion.

Validation:
- Provider message id is unique per organization when present.
- Client message id is unique per organization when present.
- Message must be saved before routing/classification.

## New or Extended Entities

### Customer Ticket

Customer-facing representation of a principal task.

Core fields:
- `id`
- `organization_id`
- `public_protocol`
- `task_id`
- `client_id`
- `contact_id`
- `conversation_id`
- `title`
- `external_status`
- `internal_status`
- `priority_for_internal_use`
- `due_at`
- `opened_at`
- `resolved_at`
- `closed_at`
- `last_customer_message_at`
- `last_agent_message_at`
- `waiting_customer_since`
- `created_by`
- `created_from_message_id`
- `created_at`
- `updated_at`

Relationships:
- Belongs to one organization, one client and one principal Kanban task.
- Belongs to one contact/conversation for the originating interaction.
- Has many task-message links, SLA records, events and reminders.

Validation:
- One principal ticket per principal task in this flow.
- Public protocol must be unique and human-readable per organization.
- External status cannot expose internal-only states.
- Closing requires resolved state and configured quiet period unless manually forced by authorized user.

State transitions:
- `open` -> `waiting_customer`
- `open` -> `in_progress`
- `waiting_customer` -> `in_progress`
- `in_progress` -> `resolved`
- `resolved` -> `closed`
- `resolved` -> `reopened`
- `closed` -> `reopened` or new triage suggestion, depending on message classification
- Any active state -> `cancelled` by authorized user with reason

### Task Message Link

Auditable relation between a WhatsApp message and a task/ticket.

Core fields:
- `id`
- `organization_id`
- `task_id`
- `ticket_id`
- `conversation_id`
- `message_id`
- `relation_type`
- `visibility`
- `released_to_customer_at`
- `released_to_customer_by`
- `linked_automatically`
- `routing_reason`
- `confidence`
- `linked_by`
- `linked_at`
- `metadata`

Validation:
- `visibility=customer` records may be sent/exposed externally.
- `visibility=internal` records must never be exposed to customer-facing flows.
- Internal comments and attachments remain private until an authorized user explicitly marks the item as released to the customer.
- A message can have multiple links only when explicitly split or referenced; each link must state relation type.

Relation types:
- `origin`
- `customer_reply`
- `agent_reply`
- `internal_comment`
- `document`
- `status_update`
- `completion`
- `reopening`
- `manual_link`
- `new_subject_detected`

### Active Ticket Context

Temporary routing context selected by the customer or inferred from a safe action.

Core fields:
- `id`
- `organization_id`
- `contact_id`
- `client_id`
- `conversation_id`
- `ticket_id`
- `task_id`
- `activated_at`
- `last_interaction_at`
- `expires_at`
- `status`
- `source`

Validation:
- Only one active context per organization/contact/conversation should be active at a time.
- Expiration is configurable and defaults to 24 hours after last interaction.
- Context must end when ticket closes, user selects a new ticket, user starts a new request or an operator ends it.
- Context activated by an official WhatsApp interactive message must preserve the provider interaction id in metadata for audit and idempotency.

### Task Suggestion

Reviewable proposal generated from a customer message or detected request.

Core fields:
- `id`
- `organization_id`
- `source_message_id`
- `conversation_id`
- `contact_id`
- `client_id`
- `suggested_title`
- `suggested_context`
- `expected_result`
- `suggested_sector`
- `suggested_assignee_user_id`
- `suggested_due_at`
- `suggested_priority`
- `missing_information`
- `related_attachment_ids`
- `classification`
- `confidence`
- `automation_eligible`
- `automation_threshold`
- `automation_decision`
- `status`
- `reviewed_by`
- `reviewed_at`
- `created_task_id`
- `created_ticket_id`
- `created_at`
- `updated_at`

Validation:
- Suggestions with confidence below 90% require human review.
- Suggestions with confidence at or above the configured high-confidence threshold, defaulting to 90%, may create task/ticket automatically when category and permission rules allow it.
- Approving a suggestion must be idempotent and cannot create duplicate task/ticket.
- Discarding a suggestion requires a reason.

States:
- `pending`
- `auto_created`
- `approved`
- `edited`
- `linked_existing`
- `discarded`
- `superseded`

### Ticket SLA Record

Tracks SLA clocks and reminder/alert milestones.

Core fields:
- `id`
- `organization_id`
- `ticket_id`
- `task_id`
- `sla_type`
- `started_at`
- `paused_at`
- `resumed_at`
- `due_at`
- `completed_at`
- `breached_at`
- `current_state`
- `waiting_reason`
- `created_at`
- `updated_at`

Validation:
- Waiting-for-customer time pauses effective execution SLA when configured.
- Every generated alert/reminder must point to a ticket and milestone.

### Ticket Event

Append-only operational event for audit, reporting and debugging.

Core fields:
- `id`
- `organization_id`
- `ticket_id`
- `task_id`
- `conversation_id`
- `message_id`
- `actor_type`
- `actor_user_id`
- `event_type`
- `old_state`
- `new_state`
- `metadata`
- `created_at`

Validation:
- Events are append-only for operational history.
- Sensitive payloads must be summarized or redacted.

### Ticket Automation Configuration

Organization-scoped settings for ticket behavior.

Core fields:
- `organization_id`
- `active_context_minutes`
- `resolved_close_business_days`
- `waiting_customer_reminder_rules`
- `sla_warning_thresholds`
- `business_hours`
- `holidays`
- `classification_confidence_thresholds`
- `automatic_creation_threshold`
- `automated_categories`
- `interactive_message_templates`
- `default_messages`
- `sensitive_document_rules`
- `updated_by`
- `updated_at`

Validation:
- Defaults must exist for organizations without custom settings.
- `automatic_creation_threshold` defaults to 90 and cannot allow automatic creation below 90 in v1.
- Interactive templates must use official WhatsApp-supported list/button payload shapes.
- Changes require admin-level permission and audit log.

## Routing Priority

1. Quoted reply to a known outbound/customer-visible message.
2. Ticket selected in the customer ticket menu.
3. Protocol explicitly provided by customer.
4. Active ticket context.
5. Automatic inference from message/context.
6. Manual triage.

Higher priority rules override lower priority rules.

## Reporting Dimensions

- Organization
- Client
- Contact
- Conversation
- Ticket
- Task
- Sector
- Responsible user
- Status
- SLA state
- Classification
- Period
- Source/routing reason
