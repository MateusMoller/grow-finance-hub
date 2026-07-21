# Contract: Internal WhatsApp Actions

## Purpose

Define internal application actions used by authenticated users to operate the WhatsApp atendimento module.

## Common Requirements

Every action must validate:

- authenticated user
- active organization
- explicit WhatsApp module access
- organization scope of target conversation/client/contact
- input shape and action intent

## Action: List Conversations

**Inputs**:

- organization
- filters: unread, status, assigned user, client, date range, search
- pagination cursor or page

**Output**:

- bounded conversation summaries
- unread counters
- pagination metadata

**Rules**:

- Default excludes archived conversations.
- Sort by latest message timestamp descending.
- Search must not return cross-organization records.

## Action: Open Conversation

**Inputs**:

- conversation id
- message pagination cursor

**Output**:

- conversation header
- recent messages
- attachments metadata
- read state

**Rules**:

- Marks inbound messages as read for the current user only when the user opens or clears the conversation.
- Loads recent messages first.

## Action: Send Text Message

**Inputs**:

- conversation id
- message body
- internal client message id

**Output**:

- accepted outbound message with delivery state

**Rules**:

- Must reject blocked contacts, archived conversations unless reopened, inactive clients when policy forbids sending, and duplicate client message ids.
- Must reject free-form sends when the active WhatsApp atendimento window is closed.
- Must create audit event before or during provider dispatch.
- Must return controlled failure state when provider send fails.

## Action: Send Attachment

**Inputs**:

- conversation id
- file metadata
- optional caption
- internal client message id

**Output**:

- outbound message with attachment metadata and delivery state

**Rules**:

- Validate file type and size; v1 accepts only images, PDFs and common documents up to 25 MB.
- Reject audio, video and unsupported media types with controlled UI-safe reasons.
- Must reject free-form attachment sends when the active WhatsApp atendimento window is closed.
- Store or process file through authorized backend/storage path.
- Prevent duplicate sends by idempotency key.

## Action: Link Client

**Inputs**:

- conversation/contact id
- target active client id

**Output**:

- updated conversation/contact link

**Rules**:

- Target client must be active and in same organization.
- Automatic contact-to-client linking is allowed only when exactly one active client in the same organization has the normalized matching phone.
- No-match and multi-match cases must remain unmatched/conflict until manually linked.
- Must create audit event.

## Action: Assign Conversation

**Inputs**:

- conversation id
- assignee user id or team
- optional reason

**Output**:

- updated assignment
- assignment event
- notification for target user when applicable

**Rules**:

- Assignee must be eligible for organization/module access.
- Only authorized users can change assignment.

## Action: Change Status

**Inputs**:

- conversation id
- new status
- optional reason

**Output**:

- updated conversation status
- status event

**Rules**:

- New inbound client message reopens resolved conversations or moves pending-client conversations back into active attention.
- Archived conversations are hidden from default queue.
