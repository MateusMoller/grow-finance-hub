# Contract: WhatsApp Webhook

## Purpose

Define the inbound provider-facing contract for receiving WhatsApp verification, inbound messages, media notifications and delivery status updates.

## Surface

- External webhook endpoint owned by backend function.
- No browser/client code may call this contract directly.

## Verification Request

**Actor**: WhatsApp provider

**Input**:

- Verification mode
- Verification challenge
- Verification token

**Expected behavior**:

- If token matches configured server-side token, return challenge.
- If token is missing or invalid, reject with controlled error.
- Do not expose configured token in logs or responses.

## Event Request

**Actor**: WhatsApp provider

**Input classes**:

- Inbound client message
- Inbound media reference
- Outbound delivery/read status
- Provider error/status notification

**Required validation**:

- Verify provider signature when available.
- Validate payload shape before processing.
- Resolve organization/business phone mapping server-side.
- Match contacts to active clients only when exactly one active client in the organization has the normalized matching phone.
- Deduplicate by provider event/message identifiers.
- Reject or quarantine events that cannot be mapped safely.

## Processing Outcomes

### Inbound Message Accepted

Creates or updates:

- WhatsApp Contact
- WhatsApp Conversation
- WhatsApp Message
- Conversation Event
- Conversation Notification

Updates:

- latest message summary
- unread count
- conversation status when applicable
- active WhatsApp atendimento window expiration
- notification target: assigned responsible user when present, otherwise eligible queue/team recipients

### Delivery Status Accepted

Updates:

- message delivery state
- failure reason if failed
- conversation event
- notification when outbound failure requires human attention

### Media Event Accepted

Creates:

- message record with media metadata
- attachment record with `pending` or `stored` status
- event for media processing result
- blocked attachment event when media is audio, video, unsupported, or over 25 MB

## Failure Behavior

- Invalid verification: reject.
- Invalid signature: reject.
- Unknown organization mapping: reject or quarantine without exposing data.
- Duplicate event: return success without creating duplicate records.
- Media retrieval failure: keep message visible with failed attachment status.

## Audit Requirements

Each accepted event must create an audit event containing:

- organization
- conversation
- message when available
- event type
- provider event/message reference
- controlled metadata
- timestamp

Raw secrets and full sensitive documents must not be logged.
