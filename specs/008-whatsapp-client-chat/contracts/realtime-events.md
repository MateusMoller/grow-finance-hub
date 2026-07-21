# Contract: Realtime Events

## Purpose

Define internal UI update events for active users of the WhatsApp atendimento module.

## Event: Conversation Upserted

**When emitted**:

- new inbound message
- outbound message accepted
- delivery status update
- assignment change
- status change
- client link change

**Payload**:

- conversation id
- organization id
- latest message summary
- status
- assignment
- unread count
- last message timestamp
- active atendimento window state and expiration

**UI behavior**:

- Upsert conversation in list.
- Re-sort list by latest message timestamp.
- Update unread markers and filters.

## Event: Message Inserted

**When emitted**:

- inbound message accepted
- outbound message created

**Payload**:

- conversation id
- message id
- direction
- message type
- safe preview/body
- delivery state
- timestamp
- attachment metadata when present
- blocked reason when dispatch or attachment policy blocks the message

**UI behavior**:

- If conversation is open, append message to timeline.
- If conversation is not open, update unread indicators.

## Event: Message Status Updated

**When emitted**:

- provider delivery/read/failed status received
- outbound send fails internally

**Payload**:

- conversation id
- message id
- delivery state
- failure reason when applicable
- timestamp

**UI behavior**:

- Update bubble status.
- Show retry option for failed outbound messages when allowed.

## Event: Notification Created

**When emitted**:

- new client message requires attention
- conversation assigned to user
- outbound message fails

**Payload**:

- notification id
- conversation id
- target user id
- target scope: user or queue
- title
- safe body preview
- created timestamp

**UI behavior**:

- Update notification counters.
- Show in-app visual indicator when user is active.
- Navigate to related conversation when clicked.

## Reliability Rules

- UI must tolerate missed realtime events by refetching on route focus and filter changes.
- Events are hints, not the sole source of truth.
- Duplicate realtime events must not create duplicate messages in UI.
