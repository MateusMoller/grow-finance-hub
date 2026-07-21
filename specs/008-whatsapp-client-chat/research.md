# Research: WhatsApp Client Chat

## Decision: Use Meta WhatsApp Business Platform Cloud API as the primary integration

**Rationale**: The requested workflow is a direct business-to-client WhatsApp channel where the client continues using WhatsApp normally while the internal team uses the Grow system. Meta's WhatsApp Business Platform supports Cloud API messaging, receiving events through webhooks, and sending text/media messages from a business number. Official Meta docs describe Cloud API messaging and webhooks as the intended interface for this type of integration.

**Alternatives considered**:

- Third-party BSP aggregator: may simplify setup but adds vendor dependency, extra billing surface and different webhook semantics.
- Manual WhatsApp Web automation: rejected because it is fragile, not appropriate for production support and conflicts with backend-owned reliability requirements.
- Client portal chat only: rejected because the product requirement is explicitly WhatsApp on the client side.

**Primary sources**:

- Meta WhatsApp Business Platform overview: https://developers.facebook.com/documentation/business-messaging/whatsapp/about-the-platform
- Meta WhatsApp webhooks overview: https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview
- Meta messages send documentation: https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages
- Meta messages webhook reference: https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages

## Decision: Own inbound webhook verification and processing in backend functions

**Rationale**: Webhooks deliver inbound messages and delivery statuses from Meta to the system. Verification, signature checks, payload normalization, tenant resolution, deduplication and audit must run in a backend context. This satisfies the constitution requirement that external integration rules and sensitive actions are backend-owned.

**Alternatives considered**:

- Browser polling external API: rejected because credentials would be exposed and updates would be delayed.
- Direct database write by external provider: rejected because it bypasses validation, audit and tenant mapping.

## Decision: Store conversations and messages as organization-scoped operational records

**Rationale**: Conversation queue, unread indicators, assignment, statuses and client linkages must be queryable and secured by organization. A normalized data model with denormalized conversation summary fields supports high-volume list rendering while preserving complete message history.

**Alternatives considered**:

- Store only raw webhook JSON: insufficient for search, filters, assignments and UI performance.
- Store one table only for all messages and conversation metadata: simpler initially but weak for indexing, audit and state transitions.

## Decision: Use provider IDs plus internal idempotency keys for deduplication

**Rationale**: Inbound webhooks can be retried by providers, and outbound sends can be triggered repeatedly by user actions or retry flows. The system must treat provider message IDs and internal client request IDs as uniqueness boundaries to prevent duplicate messages.

**Alternatives considered**:

- Frontend-only send lock: helpful for UX but insufficient against retries, multiple tabs, network retries or backend replays.
- Content/time-window dedupe only: unsafe because two legitimate messages can have identical text close together.

## Decision: Block free-form outbound replies outside the active WhatsApp atendimento window in v1

**Rationale**: The first version must keep WhatsApp policy handling predictable and avoid silently sending messages that the provider will reject. The backend send function must check the active atendimento window before dispatching a free-form text or attachment message. When the window is closed, the UI shows a controlled blocked state and does not send the message. Template-based reopening is deferred.

**Alternatives considered**:

- Let the provider reject closed-window sends: rejected because it creates delayed failures and poor operator feedback.
- Implement template-based reopening in v1: deferred because it introduces template approval, category, language and consent workflows beyond this first module.

## Decision: Automatically link contacts to clients only on a unique active phone match

**Rationale**: Automatic linkage is useful only when the phone number maps safely to exactly one active client in the same organization. No-match and multi-match cases must remain unidentified/conflict until a user links manually. This avoids attaching client conversations to the wrong company.

**Alternatives considered**:

- Link to the first matching client: rejected because it is unsafe.
- Require manual linking for all contacts: safer but less efficient for common exact matches.

## Decision: Notify the responsible user first, otherwise the eligible queue/team

**Rationale**: Assigned conversations have a clear owner, so new inbound messages should notify that responsible user. Unassigned conversations need queue visibility, so the backend creates notifications for eligible queue/team recipients according to module/sector access.

**Alternatives considered**:

- Notify every WhatsApp module user for every inbound message: noisy and likely to be ignored.
- Notify only a fixed admin group: misses operational owners and does not scale by team.

## Decision: Use backend-mediated attachment/media handling

**Rationale**: Media received through WhatsApp may require provider-authenticated retrieval. Files must be validated, scanned/limited by type and size, stored in organization-scoped paths and served through authorized short-lived access. The frontend should never receive provider credentials.

**Alternatives considered**:

- Store remote provider media URLs only: rejected because access may expire and does not satisfy storage authorization requirements.
- Direct browser upload to provider: rejected for credential and policy control reasons.

## Decision: Limit v1 attachments to images, PDFs and common documents up to 25 MB

**Rationale**: The first version should cover common atendimento files while keeping validation, storage and preview behavior manageable. Audio and video are out of scope for v1 and must be blocked with a controlled reason.

**Alternatives considered**:

- Accept every WhatsApp media type: rejected because audio/video add player, processing and retention considerations not required for v1.
- Limit to PDFs only: too restrictive for client service workflows that commonly exchange images and office documents.

## Decision: Use WhatsApp Web-inspired two-pane UX with bounded data loading

**Rationale**: The user explicitly asked for a clean, dynamic interface strongly inspired by WhatsApp Web. A left conversation list and right active conversation matches user expectations, supports fast scanning, and gives room for message composition, attachments and client context.

**Alternatives considered**:

- Ticket-table-first UX: better for helpdesk reporting but less aligned with the desired WhatsApp conversation experience.
- Full-screen single conversation only: simpler on mobile but slower for internal desktop operations.

## Decision: Treat internal notes as out of scope for v1

**Rationale**: The spec requires client-facing WhatsApp communication and explicitly warns that internal-only metadata must not leak to clients. Existing task details already provide internal andamento/chat patterns. Keeping internal notes outside v1 reduces leakage risk and keeps the module focused.

**Alternatives considered**:

- Add internal comments inside the same conversation: useful but higher risk of sending internal content accidentally.
- Add separate internal side panel: viable future enhancement after the WhatsApp flow is stable.
