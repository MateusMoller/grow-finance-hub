# Data Model: WhatsApp Client Chat

## Entity: WhatsApp Conversation

Represents a one-to-one conversation between the organization and a WhatsApp contact.

**Fields**:

- `id`: unique conversation identifier
- `organization_id`: owning organization
- `contact_id`: linked WhatsApp Contact
- `client_id`: optional linked active client
- `status`: `open`, `in_attendance`, `pending_client`, `resolved`, `archived`
- `assigned_to_user_id`: optional responsible internal user
- `assigned_team`: optional team/sector ownership
- `last_message_id`: latest message in the conversation
- `last_message_at`: timestamp for list ordering
- `last_message_preview`: safe text preview or attachment label
- `unread_count`: unread inbound messages for current operational queue
- `last_inbound_at`: latest client message timestamp
- `last_outbound_at`: latest internal outbound message timestamp
- `active_window_expires_at`: timestamp until free-form outbound messages are allowed
- `created_at`, `updated_at`

**Relationships**:

- Belongs to one organization
- Belongs to one WhatsApp Contact
- May link to one active Client
- Has many WhatsApp Messages
- Has many Conversation Events

**Validation Rules**:

- Must be organization-scoped.
- Archived conversations remain readable but are excluded from default active queue.
- Linked client must belong to the same organization and be active.
- A contact should have at most one active conversation per organization and business phone identity.
- Free-form outbound text and attachments are allowed only while `active_window_expires_at` is in the future.

**State Transitions**:

- `open` -> `in_attendance`
- `open` -> `pending_client`
- `in_attendance` -> `pending_client`
- `in_attendance` -> `resolved`
- `pending_client` -> `in_attendance` when client replies
- `resolved` -> `open` or `in_attendance` when new client message arrives
- Any non-archived status -> `archived` by authorized user

## Entity: WhatsApp Contact

Represents the client-side WhatsApp identity.

**Fields**:

- `id`
- `organization_id`
- `phone_number`
- `display_name`
- `profile_name`
- `client_id`: optional linked client
- `auto_link_source`: `unique_phone_match`, `manual`, or null
- `match_status`: `matched`, `unmatched`, `manual`, `conflict`
- `last_seen_at`
- `is_blocked`
- `created_at`, `updated_at`

**Relationships**:

- Belongs to one organization
- May link to one active Client
- Has many conversations over time

**Validation Rules**:

- Phone number must be normalized for comparison.
- Contact-to-client link must remain within the organization.
- Automatic client linkage is allowed only when exactly one active client in the organization has the normalized matching phone.
- No-match and multi-match cases must remain unmatched/conflict until manually resolved.
- Blocked contacts cannot receive new outbound messages.

## Entity: WhatsApp Message

Represents a single inbound or outbound message.

**Fields**:

- `id`
- `organization_id`
- `conversation_id`
- `contact_id`
- `client_id`: denormalized optional linked client at message time
- `direction`: `inbound` or `outbound`
- `sender_user_id`: internal sender for outbound messages
- `provider_message_id`: WhatsApp message identifier when available
- `client_message_id`: internal idempotency key for outbound sends
- `message_type`: `text`, `image`, `document`, `unknown`
- `body`: text body or caption
- `safe_preview`
- `delivery_status`: `queued`, `sending`, `sent`, `delivered`, `read`, `failed`, `received`
- `failure_reason`: controlled error text/code for failed sends
- `blocked_reason`: controlled code when the backend blocks dispatch before provider send
- `sent_at`, `received_at`, `created_at`, `updated_at`

**Relationships**:

- Belongs to one organization
- Belongs to one conversation
- May have one or more attachments
- Has status events in Conversation Event

**Validation Rules**:

- Every message must be organization-scoped and conversation-scoped.
- Inbound messages must be unique by provider message ID when present.
- Outbound messages must be unique by organization, sender/action context and client message ID.
- Outbound free-form messages outside the active atendimento window are stored as blocked/failed audit state and are not dispatched to the provider.
- Failed messages remain visible and retryable without creating duplicate successful sends.

## Entity: Conversation Attachment

Represents media associated with a message.

**Fields**:

- `id`
- `organization_id`
- `conversation_id`
- `message_id`
- `direction`
- `provider_media_id`
- `storage_path`
- `file_name`
- `content_type`
- `size_bytes`
- `allowed_type`: `image`, `pdf`, `document`, or null
- `status`: `pending`, `stored`, `failed`, `blocked`
- `failure_reason`
- `created_at`

**Relationships**:

- Belongs to one message
- Belongs to one conversation and organization

**Validation Rules**:

- File type and size must be validated before internal access.
- V1 accepts only images, PDFs and common documents up to 25 MB.
- Audio, video and unsupported media types must be blocked with a controlled reason.
- Storage path must include organization and conversation scope.
- Access must require authorization and short-lived links.

## Entity: Conversation Assignment

Represents assignment history and current responsibility.

**Fields**:

- `id`
- `organization_id`
- `conversation_id`
- `assigned_to_user_id`
- `assigned_team`
- `assigned_by_user_id`
- `reason`
- `created_at`

**Relationships**:

- Belongs to one conversation
- References internal users within the organization

**Validation Rules**:

- Only authorized users can assign or reassign.
- Assignee must be active and eligible for the module/organization.

## Entity: Conversation Event

Represents audit and operational events.

**Fields**:

- `id`
- `organization_id`
- `conversation_id`
- `message_id`
- `event_type`: `inbound_received`, `outbound_requested`, `outbound_sent`, `delivery_updated`, `send_failed`, `assignment_changed`, `status_changed`, `client_link_changed`, `attachment_stored`, `attachment_blocked`
- `actor_user_id`
- `provider_event_id`
- `details`
- `created_at`

**Relationships**:

- Belongs to organization and conversation
- May reference a message

**Validation Rules**:

- Must not store raw secrets or full sensitive payloads in details.
- Must be append-only for audit integrity.

## Entity: Conversation Notification

Represents internal alerts generated from conversation events.

**Fields**:

- `id`
- `organization_id`
- `conversation_id`
- `target_user_id`
- `target_scope`: `user` or `queue`
- `notification_type`: `new_message`, `assigned`, `send_failed`
- `title`
- `body`
- `read_at`
- `created_at`

**Relationships**:

- Belongs to one organization
- References one conversation
- Targets one internal user

**Validation Rules**:

- Notification target must be an internal user in the same organization.
- New inbound messages notify the assigned responsible user when present; otherwise they notify eligible queue/team recipients.
- Notification preview must avoid sensitive document contents.
