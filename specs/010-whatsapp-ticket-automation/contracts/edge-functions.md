# Contracts: Edge Functions

## `whatsapp-webhook`

Purpose: Receive provider webhook events, persist messages/statuses idempotently and dispatch routing/classification work.

Input classes:
- Verification challenge from provider.
- Inbound message event.
- Message status event.
- Media metadata event.

Required behavior:
- Validate provider signature and verification token.
- Normalize phone, message type, provider ids, timestamps and reply references.
- Insert raw webhook log before processing.
- Upsert message/status using provider idempotency keys.
- Download/store media when possible; otherwise record attachment failure.
- Resolve route using priority: quoted reply, selected ticket, protocol, active context, inference, triage.
- Process official WhatsApp interactive list/button replies for company, ticket and action selection.
- Create ticket event/audit record for every route decision.
- Return success for duplicate events without duplicating downstream records.

Failure behavior:
- Invalid signature returns unauthorized.
- Malformed payload records controlled failure and does not expose secrets.
- Provider/media failures persist failure state for retry or triage.

## `whatsapp-send-message`

Purpose: Send text messages from internal users to a customer conversation/ticket.

Required input:
- Conversation id.
- Optional ticket/task id.
- Message body.
- Client message id.
- Optional reply-to provider message id.
- Optional flag indicating whether customer response is required.

Required behavior:
- Authenticate user JWT.
- Validate WhatsApp module access and target organization.
- Validate user can act on the target ticket/task/client.
- If ticket/task id is present, persist task-message link with `agent_reply`.
- Format provider payload with attendant identity when required by the calling flow.
- Format official WhatsApp interactive list/button payloads when sending customer menus for company, ticket or action selection.
- Upsert outbound message by client message id.
- Update conversation, ticket last-agent timestamp and waiting-customer status when requested.
- Create notification/event/audit records.

Failure behavior:
- If provider send fails, persist outbound message with failure status and safe failure reason.
- Do not mark ticket as waiting customer unless outbound message is accepted or explicitly stored as attempted with clear failure state.

## `whatsapp-media`

Purpose: Send and retrieve media for WhatsApp conversations and ticket/task chats.

Required input:
- Conversation id.
- Optional ticket/task id.
- File metadata and upload path or media id.
- Client message id for outbound media.

Required behavior:
- Validate file type, size, bucket and path ownership.
- Upload/send media through provider for outbound files.
- Persist attachment record and link to ticket/task when applicable.
- Generate short-lived scoped URLs for authorized previews/downloads.
- Provide retry path for failed inbound media downloads.

Failure behavior:
- Store failed media state with reason.
- Never expose storage paths or provider tokens to the browser.

## `whatsapp-ticket-actions`

Purpose: Backend owner for ticket operations that cannot be frontend-only.

Actions:
- `list_customer_tickets_for_contact`
- `select_ticket_context`
- `clear_ticket_context`
- `create_task_suggestion`
- `auto_create_high_confidence_task`
- `approve_task_suggestion`
- `discard_task_suggestion`
- `link_message_to_existing_task`
- `release_internal_attachment_to_customer`
- `complete_ticket_task`
- `reopen_ticket`
- `resolve_ticket`
- `close_ticket`
- `request_ticket_update`

Required behavior:
- Authenticate internal users for internal actions.
- Validate contact/client access for customer-origin actions.
- Enforce organization, client, ticket and task boundaries.
- Enforce 90% minimum confidence for automatic task/ticket creation in v1.
- Enforce explicit authorized release before any internal task attachment becomes customer-visible.
- Enforce idempotency for approving suggestions and creating tasks/tickets.
- Record ticket event and operational audit for every state change.

Failure behavior:
- Return controlled errors for unauthorized, invalid state transition, duplicate approval, missing required completion data, blocked completion and stale context.

## Scheduled Jobs

### Expire Contexts

Runs periodically. Expires active ticket contexts whose `expires_at` is in the past and records a context-expired event.

### SLA Alerts

Runs periodically. Evaluates active SLA records and emits warning/breach events at configured thresholds.

### Waiting Customer Reminders

Runs periodically. Finds tickets waiting for customer and sends configured reminders when milestones are due.

### Close Resolved Tickets

Runs periodically. Closes resolved tickets after configured quiet period and records closure event.

### Reprocess Failures

Runs periodically. Retries safe failed media/message/classification work subject to retry limits.
