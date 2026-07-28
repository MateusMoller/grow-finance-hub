# Data Model: Improved WhatsApp Message Flow

## WhatsApp Conversation

Represents one conversation thread with a WhatsApp sender.

**Fields**:
- `id`
- `organization_id`
- `contact_id`
- `client_id`
- `status`
- `assigned_team`
- `assigned_to_user_id`
- `last_message_at`
- `last_message_preview`
- `unread_count`
- `active_window_expires_at`
- `provider_phone_number_id`
- `provider_display_phone_number`

**Relationships**:
- Belongs to one organization.
- Belongs to one WhatsApp contact.
- May be linked to one client.
- Has many messages, events, notifications, attachments, tickets, and active flow sessions.

**Validation rules**:
- Must remain organization-scoped.
- Client link must not be removed automatically after manual linking.
- Outbound messages for a conversation should use that conversation's provider phone number when available.
- Client-facing task consultation and task creation require a reliable linked client.

**State transitions**:
- `open` -> `in_attendance` when the client requests human attendance.
- `in_attendance` -> `open` when attendance is ended or returned to automatic flow.
- `open` -> `delivery_blocked` when an automatic flow message fails and the next automatic step must stop.
- `delivery_blocked` -> `open` or `in_attendance` only after internal intervention or an explicit valid retry path.
- Any active ticket context can be cleared when the client returns to menu or ends the flow.

## WhatsApp Contact

Represents the external WhatsApp sender.

**Fields**:
- `id`
- `organization_id`
- `phone_number`
- `display_name`
- `profile_name`
- `client_id`
- `match_status`
- `is_blocked`

**Relationships**:
- May link to one client.
- Can have one or more conversations over time.

**Validation rules**:
- Phone matching must be normalized.
- Client-linked contacts must not expose unrelated client tasks.

## WhatsApp Message

Represents one inbound or outbound WhatsApp message.

**Fields**:
- `id`
- `organization_id`
- `conversation_id`
- `direction`
- `sender_type`
- `body`
- `message_type`
- `delivery_status`
- `failure_reason`
- `provider_message_id`
- `client_message_id`
- `provider_phone_number_id`
- `provider_display_phone_number`
- `metadata`
- `created_at`

**Relationships**:
- Belongs to one conversation.
- May have attachments.
- May be linked to a customer ticket or internal task.

**Validation rules**:
- Provider and client message IDs must be idempotent where present.
- Failed outbound messages must retain failure details for internal review.

## Automatic Flow Session

Represents an in-progress guided request creation flow.

**Fields**:
- `id`
- `organization_id`
- `conversation_id`
- `client_id`
- `contact_id`
- `status`
- `request_type_id`
- `sector`
- `title`
- `metadata`
- `source_message_id`
- `expires_at`
- `cancelled_at`
- `completed_at`
- `created_ticket_id`
- `blocked_at`
- `block_reason`

**Relationships**:
- Belongs to one conversation.
- May create one customer ticket and one internal task.
- May reference source and answer messages.

**Validation rules**:
- Only one active creation flow per conversation should exist.
- Expired flows cannot accept new answers.
- Cancellation must stop the active flow cleanly.
- New request creation cannot complete unless `client_id` is present and reliable.
- Delivery failure must block the next automatic step until internal intervention.

**State transitions**:
- `collecting_request_type` -> `collecting_title`
- `collecting_title` -> `collecting_description`
- `collecting_description` -> `completed`
- Any collecting state -> `cancelled`
- Any collecting state -> `expired` by time
- Any collecting state -> `blocked` after automatic message delivery failure

## Request Type

Represents a user-managed solicitation option.

**Fields**:
- `id`
- `organization_id`
- `title`
- `slug`
- `description`
- `sector`
- `form_fields`
- `is_active`
- `sort_order`

**Relationships**:
- Used by WhatsApp flow and portal request creation.
- Maps client-facing intent to internal sector.

**Validation rules**:
- Active request types must have a non-empty title.
- Generic request type must map to a neutral sector unless explicitly configured otherwise.
- Only active request types appear in WhatsApp choices.

## Customer Ticket

Represents the client-facing tracking record.

**Fields**:
- `id`
- `organization_id`
- `public_protocol`
- `client_id`
- `contact_id`
- `conversation_id`
- `task_id`
- `title`
- `status`
- `responsible_user_id`
- `opened_from_message_id`
- `created_at`
- `updated_at`

**Relationships**:
- Belongs to one internal task.
- Belongs to one client/contact when available.
- May be linked to many WhatsApp messages.

**Validation rules**:
- Public protocol must be unique per organization.
- Listed tickets must be scoped to the linked client.

## Internal Task

Represents work created for the Grow team.

**Fields**:
- Existing task identity and title fields.
- Client reference.
- Responsible sector.
- Status.
- Priority.
- Description.
- Source metadata.
- Integration/task source identifier.

**Relationships**:
- May be generated from one WhatsApp flow.
- May have one customer ticket.
- May reference WhatsApp messages and attachments.

**Validation rules**:
- Users may create tasks for any sector, but visibility remains limited by permissions and sector access.
- WhatsApp-generated tasks must include enough source metadata to audit the origin.
- WhatsApp-generated tasks must not be created for unlinked contacts.

## Conversation Event

Represents audit history.

**Fields**:
- `id`
- `organization_id`
- `conversation_id`
- `message_id`
- `event_type`
- `details`
- `created_at`

**Relationships**:
- Belongs to one conversation.
- May reference a specific message.

**Validation rules**:
- Must record menu delivery, selection, task creation, queue routing, delivery failures, greeting, and flow end.
- Delivery failure events must include enough provider context for internal diagnosis without exposing secrets.

## Conversation Attachment

Represents media/file payloads.

**Fields**:
- `id`
- `organization_id`
- `conversation_id`
- `message_id`
- `file_name`
- `content_type`
- `size_bytes`
- `storage_path`
- `status`
- `failure_reason`

**Relationships**:
- Belongs to one message and conversation.
- May be used as task context.

**Validation rules**:
- Must follow existing file validation and access rules.
- Failed media downloads must remain visible internally.
