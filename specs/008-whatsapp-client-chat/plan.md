# Implementation Plan: WhatsApp Client Chat

**Branch**: `008-whatsapp-client-chat` | **Date**: 2026-07-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-whatsapp-client-chat/spec.md`

## Summary

Implement an internal WhatsApp atendimento module for one-to-one client conversations. The client keeps using WhatsApp normally, while the internal team uses a clean WhatsApp Web-inspired interface inside Grow. V1 supports conversation list, active chat, inbound/outbound text inside the active WhatsApp atendimento window, allowed attachments, safe automatic client linking, assignment/status, notifications and audit. Backend functions own webhook processing, provider communication, active-window enforcement, media validation, deduplication and sensitive credentials.

## Technical Context

**Language/Version**: TypeScript, React 18, Vite, Supabase Edge Functions

**Primary Dependencies**: React Router, TanStack Query, Supabase JS, shadcn/Radix, lucide-react, Sonner, WhatsApp Business Platform/Cloud API

**Storage**: Supabase Postgres for conversations/messages/events/assignments; Supabase Storage for attachments/media

**Testing**: `npm run lint`, `npm run test`, `npm run build`, targeted Supabase SQL/RLS checks, webhook contract fixtures

**Target Platform**: Internal web app in modern desktop/tablet browsers; Supabase backend functions and webhooks

**Project Type**: Web application with backend integration functions

**Performance Goals**: 10,000 conversations per organization; active inbound messages visible within 3 seconds after acceptance; common list/search/filter interactions under 1 second; opening typical 100-message conversation under 2 seconds; local send feedback under 500 ms; duplicate outbound sends blocked in acceptance tests

**Constraints**: No WhatsApp tokens or service-role credentials in browser code; backend-owned deduplication and webhook validation; free-form outbound replies only inside active WhatsApp atendimento window; images/PDFs/common documents up to 25 MB only; tenant-aware storage and RLS; bounded list/message loading; no client portal exposure in v1

**Scale/Scope**: First version covers one-to-one client conversations, inbound/outbound text within active atendimento windows, inbound/outbound images/PDFs/common documents up to 25 MB, automatic client linking only on unique active phone match, manual linking for conflicts, assignment/status, queue-aware notifications and audit. Excludes WhatsApp groups, campaigns, bulk broadcast, template-based reopening, audio/video attachments, voice/video calls and marketing automation.

**Affected Surfaces**: internal app, Supabase database, Edge Functions, Storage, notifications, webhooks, external WhatsApp integration

**Security/Tenant Scope**: Internal users with explicit WhatsApp module access only. All tables, storage paths, functions and events are organization-scoped. Optional client linkage must reference active clients in the same organization. Integration credentials and privileged operations remain in Edge Functions/backend only.

**Business Rule Owner**: Edge Functions/webhooks own WhatsApp send/receive, webhook verification, active-window enforcement, media retrieval, attachment policy validation, deduplication, delivery status normalization, notification target selection and credential use. Supabase migrations/RLS own tenant access, uniqueness, constraints and storage scope. Frontend owns presentation, optimistic feedback and non-sensitive UI state.

**Observability/Rollback**: Conversation event audit table records inbound/outbound message, blocked sends, status changes, assignment changes, linkage changes and failures. Edge Function logs use controlled metadata only. Migrations include additive rollout with nullable tables/columns, RLS policies, indexes and rollback by disabling route/module and removing webhook registration before dropping data structures.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Security and Least Privilege

- [x] Public, internal, and client-portal surfaces remain separated by route, role, and backend authorization.
- [x] No secrets, service-role keys, OpenAI/WhatsApp/Open Finance/Acessorias credentials, or integration tokens are exposed to client code or logs.
- [x] Privileged operations validate JWT, organization, role, client access, action intent, and input shape before using service-role access.

### Tenant Isolation and Data Segregation

- [x] New or changed operational data is organization-aware.
- [x] Client portal flows remain out of scope for v1.
- [x] RLS, storage policies, and signed URL scope are addressed for affected tables/files.

### Backend-Owned Business Rules

- [x] Authorization, synchronization, deduplication, external integration rules, active-window enforcement, notification targeting and attachment policy live in backend/RLS layers.
- [x] Frontend-only rules are non-sensitive presentation and optimistic UI state.

### Scalable Frontend and Data Access

- [x] Shared/repeated remote state uses TanStack Query.
- [x] Independent requests start early and use `Promise.all` where safe.
- [x] High-volume lists and filters use server filtering, indexes, pagination and bounded message loading.
- [x] Public routes avoid importing internal-only workflows or heavy dependencies.

### Auditability, Reliability, and Operability

- [x] Operational state changes have audit/logging coverage for actor, organization, client, action and integration participation.
- [x] Integration and webhook failures fail closed for sensitive actions and return controlled UI errors.
- [x] Validation commands are identified: `npm run lint`, `npm run test`, `npm run build`, targeted SQL/RLS checks and webhook fixture checks.
- [x] Migrations include rollout and rollback considerations.

## Project Structure

### Documentation (this feature)

```text
specs/008-whatsapp-client-chat/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── whatsapp-webhook.md
│   ├── internal-actions.md
│   └── realtime-events.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── pages/
│   └── WhatsAppAtendimentoPage.tsx
├── components/
│   └── whatsapp/
│       ├── ConversationList.tsx
│       ├── ConversationPanel.tsx
│       ├── MessageBubble.tsx
│       ├── MessageComposer.tsx
│       ├── ConversationHeader.tsx
│       └── ConversationFilters.tsx
├── hooks/
│   ├── useWhatsAppConversations.ts
│   ├── useWhatsAppMessages.ts
│   └── useWhatsAppRealtime.ts
├── lib/
│   ├── whatsappConversations.ts
│   ├── whatsappMessages.ts
│   └── whatsappMedia.ts
└── integrations/
    └── supabase/
        └── types.ts

supabase/
├── migrations/
│   └── [timestamp]_add_whatsapp_client_chat.sql
└── functions/
    ├── whatsapp-webhook/
    │   └── index.ts
    ├── whatsapp-send-message/
    │   └── index.ts
    └── whatsapp-media/
        └── index.ts
```

**Structure Decision**: Use the existing single web app with Supabase-backed Edge Functions. UI stays in `src/pages`, `src/components`, `src/hooks`, and `src/lib`. Integration credentials, webhook validation, active-window checks, media retrieval and outbound message dispatch stay in `supabase/functions`. Tenant schema, RLS, indexes and storage policies are delivered by migrations.

## Phase 0: Research

Research is captured in [research.md](./research.md). All initial technical unknowns are resolved:

- WhatsApp integration entrypoint: Meta WhatsApp Business Platform Cloud API.
- Free-form outbound policy: allow only inside active atendimento window; template-based reopening is deferred.
- Webhook ownership: backend Edge Function with verification and signature validation.
- Client matching: automatic only when exactly one active client in the organization has the matching phone number.
- Notification routing: assigned conversation notifies the responsible user; unassigned conversation notifies the eligible queue/team.
- Deduplication: provider message IDs plus internal idempotency keys.
- Media handling: backend-mediated retrieval/upload into scoped storage; v1 accepts images, PDFs and common documents up to 25 MB, excluding audio/video.
- UI model: WhatsApp Web-inspired two-pane layout with bounded lists and realtime updates.

## Phase 1: Design & Contracts

Design artifacts generated:

- [data-model.md](./data-model.md)
- [contracts/whatsapp-webhook.md](./contracts/whatsapp-webhook.md)
- [contracts/internal-actions.md](./contracts/internal-actions.md)
- [contracts/realtime-events.md](./contracts/realtime-events.md)
- [quickstart.md](./quickstart.md)

## Constitution Check - Post Design

### Security and Least Privilege

- [x] Contracts require backend-only secrets and webhook validation.
- [x] Internal actions require authenticated user, module access and organization scope.
- [x] Client portal and public surfaces remain out of scope for v1.

### Tenant Isolation and Data Segregation

- [x] Data model includes `organization_id` on all operational tables.
- [x] Storage paths are organization/conversation scoped.
- [x] Contracts require active-client linkage only within the same organization and automatic linkage only for a unique active phone match.

### Backend-Owned Business Rules

- [x] Send, receive, status normalization, media retrieval, attachment policy, active-window enforcement, notification targeting and deduplication are backend-owned.
- [x] Frontend-only logic is limited to rendering, composer state and optimistic pending UI.

### Scalable Frontend and Data Access

- [x] Conversation list and message timeline use pagination/server filtering.
- [x] High-volume lookup fields have planned indexes and denormalized summary fields.
- [x] Public route bundle is unaffected.

### Auditability, Reliability, and Operability

- [x] Data model includes conversation events and delivery state history.
- [x] Quickstart includes blocked send, attachment policy, notification routing and validation checks.
- [x] Rollback path is documented.

## Complexity Tracking

No constitution violations identified.
