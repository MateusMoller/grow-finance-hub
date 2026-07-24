# Quickstart: WhatsApp Ticket Automation

## Prerequisites

- Supabase project linked and runtime config pointing to the intended project.
- WhatsApp webhook and send-message functions configured with valid provider credentials.
- At least one internal user with WhatsApp and Tarefas access.
- At least one active client with a linked WhatsApp contact/phone.
- Local dependencies installed.

## Validation Setup

1. Apply the feature migration to the target Supabase environment.
2. Regenerate Supabase types if the environment supports it.
3. Deploy or run updated Edge Functions for webhook, send-message, media, ticket actions and scheduled jobs.
4. Start the app with `npm run dev`.
5. Open the internal app as a user with WhatsApp and Tarefas permissions.

## Story 1: Existing Ticket Routing

1. Create or identify a client with an active WhatsApp conversation.
2. Create a task and linked ticket for that client.
3. From the customer side, start a WhatsApp conversation without active context.
4. Verify the customer receives an official WhatsApp interactive list/button menu for company, ticket or action selection.
5. Select the ticket through the interactive option and send a text message plus one attachment.
6. Confirm the message and attachment appear in the task customer chat.
7. Confirm no unrelated task receives the message.
8. Confirm the active context expires 24 hours after the last interaction unless configuration overrides it.

Expected result: quoted/selected ticket routing links the inbound message to the correct task and ticket.

## Story 2: New Request Triage

1. Send a WhatsApp message from the client with no selected ticket and a clear new request.
2. Open the triage view.
3. Confirm a task suggestion appears with title, client, sector, priority, context and confidence.
4. Approve the suggestion.
5. Confirm a Kanban task, ticket and task-message origin link are created.
6. Confirm the customer receives the opening confirmation with protocol.

Expected result: the request becomes a reviewed task/ticket and is auditable.

## Story 2b: High-Confidence Automatic Creation

1. Configure or simulate classification confidence at 90% or more for a safe request.
2. Send a WhatsApp message from the client with no selected ticket and a clear single request.
3. Confirm the system creates the Kanban task and public ticket automatically.
4. Confirm confidence and automation decision are recorded in audit/events.
5. Repeat with confidence below 90% and confirm the item remains in human triage.

Expected result: only high-confidence classifications create tasks/tickets automatically.

## Story 3: Multiple Requests

1. Send one WhatsApp message with three independent requests.
2. Confirm the system creates three reviewable suggestions.
3. Approve one, edit one and discard one with reason.
4. Confirm only approved/edited suggestions create tasks and tickets.

Expected result: separate operational deliveries are not merged into one ambiguous task.

## Story 4: Waiting Customer and Reopen

1. From the task customer chat, send a message that requires customer return.
2. Mark it as waiting for customer.
3. Confirm ticket/task state changes to waiting customer.
4. Reply from WhatsApp.
5. Confirm ticket/task returns to in progress and responsible users are notified.
6. Complete the task, then send "Obrigado" from the customer.
7. Confirm it does not reopen.
8. Send a related divergence.
9. Confirm it reopens or goes to triage with reason.

Expected result: customer replies drive status only when the message content requires it.

## Story 4b: Internal Attachment Release

1. Add an internal comment and internal attachment to a ticket-linked task.
2. Confirm neither appears in the customer WhatsApp timeline.
3. Mark the attachment as released to the customer.
4. Confirm the customer-visible chat shows or sends only the explicitly released attachment.
5. Confirm the release action records actor, time and attachment id.

Expected result: internal attachments remain private until explicitly released.

## Story 5: SLA and Automation

1. Configure short SLA/reminder windows in a test organization.
2. Create a ticket with due date.
3. Wait for warning milestones.
4. Confirm alerts are recorded and delivered to intended users.
5. Resolve a ticket and let the configured close period elapse.
6. Confirm the ticket closes automatically if no relevant customer reply arrives.

Expected result: SLA, reminders and closure run without a user opening the app.

## Regression Checks

- Re-send the same webhook payload and confirm no duplicate message/task/ticket is created.
- Verify unknown phones cannot see ticket/client data.
- Verify a manually linked WhatsApp contact remains linked after new messages.
- Verify internal task comments do not appear in customer WhatsApp messages.
- Verify media failures are visible with retry/failure status.

## Quality Gates

Run before handoff:

```bash
npm run lint
npm run test
npm run build
```

Document any environment limitation, especially provider sandbox restrictions, expired tokens, missing local Docker for type generation, or unavailable WhatsApp webhook.
