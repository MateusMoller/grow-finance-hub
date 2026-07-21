# Quickstart: WhatsApp Client Chat

## Prerequisites

- Branch: `008-whatsapp-client-chat`
- Spec: `specs/008-whatsapp-client-chat/spec.md`
- Plan: `specs/008-whatsapp-client-chat/plan.md`
- Valid WhatsApp Business Platform setup for production validation
- Internal test user with explicit WhatsApp module access
- Test client/contact phone number authorized for sandbox or production testing

## Implementation Sequence

1. Create Supabase migration for WhatsApp conversations, contacts, messages, attachments, assignments, events and notifications.
2. Add RLS policies and indexes for organization-scoped access, conversation list ordering, unread filters, client linkage and message pagination.
3. Create scoped Storage bucket/policies for WhatsApp media.
4. Add Edge Function for webhook verification and inbound event processing.
5. Add Edge Function for outbound message send with idempotency and audit events.
6. Add Edge Function for media retrieval/upload/download mediation.
7. Enforce active WhatsApp atendimento window and attachment policy in backend functions.
8. Add TypeScript types for new tables/functions.
9. Add internal route/module permission key for WhatsApp atendimento.
10. Build the WhatsApp-inspired UI page with conversation list, filters, active conversation, header, message bubbles and composer.
11. Wire TanStack Query hooks and realtime updates for list/messages/notifications.
12. Add user feedback states: loading, empty, failed send, retry, blocked contact, unmatched contact and closed-window blocked send.
13. Add validation tests and manual fixture checks.

## Manual Validation Flow

1. Open internal app as a user with WhatsApp module access.
2. Confirm the WhatsApp atendimento route appears only for authorized internal users.
3. Simulate or receive an inbound client message.
4. Confirm a conversation appears at the top of the list with unread indicator.
5. Open the conversation and confirm message appears on the client side of the timeline.
6. Send a text response and confirm immediate pending/sending feedback.
7. Confirm the outbound message resolves to sent or failed with controlled UI state.
8. Repeat Enter/click rapidly and confirm only one outbound message is created.
9. Receive or send an allowed attachment and confirm metadata/download behavior.
10. Attempt a free-form response outside the active atendimento window and confirm the backend blocks it without provider dispatch.
11. Attempt audio/video or a file over 25 MB and confirm the backend blocks it with a controlled reason.
12. Confirm a unique active phone match links automatically to the correct client.
13. Confirm no-match and multi-match phone cases remain unmatched/conflict until manual linking.
14. Link an unmatched number to an active client in the same organization.
15. Assign the conversation to a user and change status.
16. Confirm assigned conversations notify the responsible user and unassigned conversations notify the eligible queue/team.
17. Confirm events are recorded and notifications are generated.

## Security Validation

- Confirm unauthenticated users cannot access the route.
- Confirm client portal users cannot access the route.
- Confirm a user from another organization cannot read conversations, messages, attachments or notifications.
- Confirm WhatsApp credentials are not exposed in browser code, local storage, logs or network payloads sent to the browser.
- Confirm signed file access is short-lived and scoped to the requested attachment.
- Confirm webhook rejects invalid verification/signature payloads.

## Performance Validation

- Seed enough conversations to test pagination and filters.
- Confirm default list loads bounded data only.
- Confirm search/filter interactions remain responsive with large datasets.
- Confirm message timeline loads recent messages first and can retrieve older history.
- Confirm active inbound updates arrive without manual refresh.

## Rollback Plan

1. Disable WhatsApp atendimento route/module access.
2. Disable webhook registration in the WhatsApp business configuration.
3. Stop outbound send function or revoke its runtime secret.
4. Preserve database records for audit unless explicitly approved for deletion.
5. If schema rollback is required, drop new policies/functions/tables only after export or retention decision.

## Implementation Notes

- Current implementation records provider dispatch through backend functions and keeps the final Meta Cloud API HTTP call isolated in `supabase/functions/_shared/whatsapp-provider.ts`.
- Outbound attachment upload uses a backend-mediated prepare/finalize flow with storage path scoped by organization and conversation.
- Manual fixture and SQL/RLS checks still require a configured Supabase runtime and test users.
