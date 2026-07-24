# Contracts: Automation Events

Events are append-only operational records used by jobs, notifications, audit and reporting.

## Message Events

- `whatsapp.message.received`
- `whatsapp.message.saved`
- `whatsapp.message.duplicate_ignored`
- `whatsapp.message.sent`
- `whatsapp.message.failed`
- `whatsapp.media.received`
- `whatsapp.media.stored`
- `whatsapp.media.failed`

Required metadata:
- organization id
- conversation id
- contact id
- client id when known
- provider message id when known
- message id when persisted
- direction
- safe preview
- failure reason when failed

## Routing Events

- `message.route.quoted_reply`
- `message.route.selected_ticket`
- `message.route.interactive_selection`
- `message.route.protocol`
- `message.route.active_context`
- `message.route.inferred`
- `message.route.triage_required`
- `message.route.denied`

Required metadata:
- routing priority used
- provider interactive reply id when applicable
- ticket id when resolved
- task id when resolved
- confidence when inferred
- denial reason when denied

## Suggestion Events

- `task.suggestion.created`
- `task.suggestion.auto_created`
- `task.suggestion.edited`
- `task.suggestion.approved`
- `task.suggestion.linked_existing`
- `task.suggestion.discarded`
- `task.suggestion.superseded`

Required metadata:
- source message id
- suggestion id
- reviewer id when reviewed
- created task/ticket ids when approved
- confidence threshold and automation decision when auto-created
- discard reason when discarded

## Ticket Events

- `ticket.created`
- `ticket.context.activated`
- `ticket.context.expired`
- `ticket.customer_reply.received`
- `ticket.agent_reply.sent`
- `ticket.attachment.released_to_customer`
- `ticket.waiting_customer`
- `ticket.in_progress`
- `ticket.resolved`
- `ticket.closed`
- `ticket.reopened`
- `ticket.cancelled`

Required metadata:
- ticket id
- task id
- old status
- new status
- actor type
- actor id when applicable
- reason when transition is manual or exceptional
- released attachment id and releasing user when applicable

## SLA Events

- `sla.started`
- `sla.paused`
- `sla.resumed`
- `sla.warning`
- `sla.breached`
- `sla.completed`
- `reminder.scheduled`
- `reminder.sent`
- `reminder.failed`

Required metadata:
- ticket id
- task id
- SLA type
- threshold or reminder step
- due date
- recipient scope
- failure reason when failed

## Notification Events

- `notification.ticket.assigned`
- `notification.customer_reply`
- `notification.sla_warning`
- `notification.sla_breach`
- `notification.ticket_reopened`
- `notification.triage_required`

Required metadata:
- target user or queue
- notification channel
- reference ticket/task/message id
- read state
