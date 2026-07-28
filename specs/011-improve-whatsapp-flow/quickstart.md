# Quickstart: Improved WhatsApp Message Flow

## Prerequisites

- WhatsApp module enabled for the organization.
- Supabase environment configured.
- WhatsApp webhook subscribed and receiving inbound messages.
- WhatsApp outbound provider credentials valid.
- At least one active request type configured.
- At least one test contact linked to a client for task consultation.

## Implementation Checklist

1. Review current WhatsApp Edge Function routing.
2. Normalize all user-facing automatic texts and remove corrupted encoding.
3. Refactor the main automatic menu to two primary choices.
4. Refactor the requests submenu to consultation vs new request.
5. Ensure human attendance routing creates internal notification and uses after-hours wording after 17:00.
6. Ensure human attendance outside Monday-Friday until 17:00 remains queued internally.
7. Ensure task consultation only returns open tasks for the linked client.
8. Ensure new request creation requires a reliable linked client before task creation.
9. Ensure new request creation uses request type mapping before sector fallback.
10. Ensure delivery failures block automatic progression and alert the internal team.
11. Preserve message and attachment context during task creation.
12. Ensure final actions are consistently `Voltar ao menu` and `Encerrar`.
13. Validate delivery-failure display and audit events.

## Manual Test Scenarios

### First message of the day

1. Clear or use a fresh WhatsApp test conversation.
2. Send a WhatsApp message from a linked client.
3. Confirm one greeting is sent.
4. Confirm main menu appears.
5. Send another message on the same day.
6. Confirm greeting is not repeated.

### Human attendance

1. Select `Falar com a equipe`.
2. Confirm the conversation appears in the attendance tab.
3. Confirm internal notification/unread indicator appears.
4. Confirm client-facing response changes after 17:00 local time.
5. Confirm requests made outside Monday-Friday until 17:00 remain visible in the internal attendance queue.

### Consult tasks

1. Link the sender to a client with open tasks.
2. Select `Solicitacoes`.
3. Select `Consultar tarefas`.
4. Confirm only that client's open tasks are listed.
5. Confirm final actions show `Voltar ao menu` and `Encerrar`.
6. Repeat with completed and archived tasks and confirm they are not listed.

### Create task

1. Select `Solicitacoes`.
2. Select `Nova solicitacao` or a request type.
3. Provide title/summary and description/context.
4. Send an attachment during the flow.
5. Confirm internal task and customer ticket are created.
6. Confirm ticket confirmation includes ticket number, title, and responsible party.
7. Confirm final actions are sent.

### Unlinked contact

1. Use a WhatsApp sender that is not linked to any client.
2. Select `Solicitacoes`.
3. Try `Consultar tarefas`.
4. Confirm the system says a client link is required.
5. Try `Nova solicitacao`.
6. Confirm no task is created automatically and the sender is guided to identification or human attendance.

### Delivery failure

1. Force or simulate a WhatsApp provider failure for an automatic flow message.
2. Confirm the failed message is visible internally with a controlled failure state.
3. Confirm the next automatic step is not sent as if delivery succeeded.
4. Confirm the conversation remains available for internal intervention or explicit retry.

### Cancellation

1. Start new task creation.
2. Send `cancelar`.
3. Confirm flow is cancelled.
4. Confirm the system offers a route back to the menu or end.

## Validation Commands

```powershell
npm run lint
npm run test
npm run build
```

Local Deno validation for Edge Functions requires the `deno` binary. In this environment it was not available, so deploy-time Edge Function validation must be confirmed through Supabase logs after publishing.

## Deployment Notes

- Deploy modified Supabase Edge Functions after validation.
- If schema changes are needed, create migration files and apply them before deploying functions that depend on them.
- Verify with one linked client and one unlinked contact after deployment.
- Automatic flow messages now stop progressing when Meta/WhatsApp returns a delivery failure. The conversation is marked for internal intervention and the next automatic step is not sent as if the previous message succeeded.
- Returning to the menu or ending the automatic flow clears any blocked task-creation flow for that conversation, allowing a fresh customer-initiated path later.
- If Meta rejects the recipient because of allow-list, authentication, country restriction, or 24-hour window rules, the system records the failure but cannot force delivery without correcting the provider-side condition.

## Rollback Notes

- Keep previous action identifiers compatible where possible.
- If a new flow fails, disable the new routing path and return to the previous menu messages.
- Preserve conversation history, events, tickets, and tasks during rollback.
