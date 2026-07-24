# Contracts: UI

## WhatsApp Attendance Page

Primary users: internal users with WhatsApp access.

Must show:
- Conversation list with unread indicators, last message, client link state and search.
- Active conversation timeline with message direction, media previews, delivery/failure state and reply references.
- Customer/ticket context area with linked client and active ticket where applicable.
- Indicator when the active context came from an official WhatsApp interactive selection.
- Quick action to create a task/ticket from selected messages.
- Quick action to link conversation/contact to an active client.

Must support:
- Paginated message loading.
- Sending text/media.
- Replying to messages.
- Selecting messages as context for a task suggestion.
- Sending official WhatsApp interactive choices for company, ticket and action selection through backend actions.
- Opening linked task/ticket.
- Displaying controlled provider errors.

Must not show:
- Internal task comments in customer-facing message history.
- Secrets, provider tokens or raw sensitive payloads.

## Task Detail Sheet - Customer Chat

Primary users: task assignees, triage users, leaders and admins with task access.

Must show:
- Ticket protocol and customer-facing status when task has a ticket.
- Customer WhatsApp chat linked to the task/ticket.
- External messages visually distinct from internal comments.
- Delivery/failure state for each customer message.
- Attachments with preview/download when authorized.
- Internal attachments that are private by default and explicit release controls for customer-visible attachments.
- Action to mark outbound message as requiring customer response.

Must support:
- Sending text and media to the customer with task/ticket header when sent from task context.
- Replying to a specific customer message.
- Releasing an internal attachment to the customer when the user has permission.
- Reopening or creating new task suggestion from a customer reply.
- Navigating to the main WhatsApp conversation.

Must not allow:
- Sending internal comments to customer.
- Editing immutable customer identity/ticket protocol from the chat.
- Completing blocked tasks without required completion data.

## Triage View

Primary users: triage, sector leads and admins.

Must show:
- Original inbound message, attachments and conversation context.
- Detected client/contact/company and confidence.
- Open tickets that may match the message.
- One or more task suggestions.
- Whether a suggestion is eligible for automatic creation because confidence is at least 90%.
- Missing information and classification confidence.
- Audit/reason trail for approvals, edits and discards.

Must support:
- Approve, approve all, edit, split, merge, link to existing task, alter company, alter sector, alter responsible, alter deadline, alter priority, respond without task and discard.
- Manual override of routing when user has permission.
- Preview of customer opening message before task/ticket creation.
- Review of automatic task/ticket creations performed from high-confidence suggestions.

Must not allow:
- Creating a customer-visible ticket for unauthorized client/contact.
- Approving low-confidence/high-risk automation without human action.

## Ticket/SLA Management

Primary users: leaders and admins.

Must show:
- Tickets by status, sector, responsible, client, due date and SLA state.
- Waiting-customer tickets and next reminder.
- Breached or near-breached SLA.
- Reopened tickets and reasons.
- Audit history.

Must support:
- Filtering and pagination.
- Manual status transition where allowed.
- Config review for reminders, context expiration and SLA.

## Reports

Must include:
- Volume by client, sector, responsible and period.
- First response, waiting-customer time, total time and effective execution time.
- Reopen rate.
- Duplicate prevention indicators.
- Suggestion approval/edit/discard counts.
- Provider send/media failures.
