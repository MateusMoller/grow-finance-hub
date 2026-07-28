# Implementation Plan: Improved WhatsApp Message Flow

**Branch**: `011-improve-whatsapp-flow` | **Date**: 2026-07-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/011-improve-whatsapp-flow/spec.md`

## Summary

Refine the WhatsApp automatic service flow so the client receives a clearer, more professional journey: one daily greeting, a two-option main menu, explicit human attendance routing, a request submenu for consulting or creating tasks, consistent post-flow actions, and safer task creation based on request types instead of exposing internal sector choices. The flow requires a reliable client link before client-facing task creation or consultation, queues human attendance requests Monday to Friday until 17:00 with an after-hours response outside that window, and stops automatic progression when WhatsApp delivery fails. The technical approach keeps business-critical routing in Supabase Edge Functions and webhooks, preserves tenant/client boundaries, reuses the existing WhatsApp UI module, and adds bounded data access for task lookup and flow context.

## Technical Context

**Language/Version**: TypeScript 5.8, React 18, Vite 8, Supabase Edge Functions using Deno-compatible TypeScript

**Primary Dependencies**: React Router, TanStack Query, Supabase JS, shadcn/Radix UI, lucide-react, Zod where validation is already used

**Storage**: Supabase Postgres, existing WhatsApp tables, task tables, client tables, request-type tables, and Supabase Storage for received/sent media

**Testing**: `npm run lint`, `npm run test`, `npm run build`; targeted SQL checks and manual WhatsApp provider validation for inbound/outbound flows

**Target Platform**: Internal web app plus Supabase Edge Functions/Webhooks connected to WhatsApp Cloud API

**Project Type**: Web application with backend-owned integration workflow

**Performance Goals**: First automatic response visible internally within 5 seconds for 95% of normal inbound messages; first actionable client menu within two outbound messages; bounded task consultation results; delivery failure handling must avoid retry loops and duplicate client-facing messages

**Constraints**: WhatsApp 24-hour service window, approved templates for re-engagement where needed, provider country/recipient restrictions, allowed recipient rules, Edge Function compute limits, tenant isolation, reliable client linking before task creation, and office-hours routing from Monday to Friday until 17:00 local Sao Paulo time

**Scale/Scope**: Existing Grow internal app, WhatsApp conversations, client-linked tasks/tickets, configurable request types, attachments, audit events, and internal notifications

**Affected Surfaces**: Internal app, Supabase database, Edge Functions, Storage, automation/webhook, external WhatsApp integration

**Security/Tenant Scope**: All conversation, task, client, request type, ticket, event, and attachment access remains organization-scoped. Client task lookup and WhatsApp task creation require a reliable contact-to-client link. Service-role operations remain backend-only and validate organization/action/input.

**Business Rule Owner**: Edge Functions and webhook own greeting, menu routing, office-hours checks, client-link enforcement, task consultation, task creation, provider send rules, idempotency, flow blocking after delivery failure, and audit events. Frontend owns display, filtering, conversation state presentation, and user-triggered actions backed by Edge Function validation.

**Observability/Rollback**: Existing WhatsApp event/log tables record greetings, menu sends, option selections, task creation, queue routing, delivery failures, and flow end. Rollback should retain schema compatibility and allow reverting to the previous menu texts/actions without deleting operational history. Provider failures must be visible internally and must not be treated as successful client-facing steps.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Security and Least Privilege

- [x] Public, internal, and client-portal surfaces remain separated by route,
      role, and backend authorization.
- [x] No secrets, service-role keys, OpenAI/WhatsApp/Open Finance/Acessorias
      credentials, or integration tokens are exposed to client code or logs.
- [x] Privileged operations validate JWT, organization, role, client access,
      action intent, and input shape before using service-role access.

### Tenant Isolation and Data Segregation

- [x] New or changed operational data is organization-aware.
- [x] Client portal flows enforce client-level access through `client_users`
      or a documented legacy fallback.
- [x] RLS, storage policies, and signed URL scope are addressed for affected
      tables/files.

### Backend-Owned Business Rules

- [x] Authorization, synchronization, deduplication, automation, completion,
      document classification, financial state, obligation state, and external
      integration rules live in the responsible backend layer.
- [x] Any frontend-only rule is non-sensitive, justified, and backed by backend
      validation where data integrity or access control matters.

### Scalable Frontend and Data Access

- [x] Shared/repeated remote state uses TanStack Query or a justified existing
      pattern.
- [x] Independent requests start early and use `Promise.all` where safe.
- [x] High-volume lists, filters, tables, and derived state use pagination,
      server filtering, indexing, `Map`/`Set`, virtualization, or another
      concrete scaling strategy.
- [x] Public routes avoid importing internal-only workflows or heavy
      dependencies.

### Auditability, Reliability, and Operability

- [x] Operational state changes have audit/logging coverage sufficient to
      identify actor, organization, client, action, and integration/automation.
- [x] Integration and webhook failures fail closed for sensitive actions and
      return controlled UI errors.
- [x] Validation commands are identified: `npm run lint`, `npm run test`,
      `npm run build`.
- [x] Migrations that alter RLS, constraints, tenant scope, or critical tables
      include rollout and rollback considerations.

## Project Structure

### Documentation (this feature)

```text
specs/011-improve-whatsapp-flow/
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   |-- whatsapp-message-flow.md
|   |-- whatsapp-actions.md
|-- checklists/
|   |-- requirements.md
|-- spec.md
|-- tasks.md
```

### Source Code (repository root)

```text
src/
|-- pages/
|   |-- WhatsAppAtendimentoPage.tsx
|-- components/
|   |-- whatsapp/
|   |   |-- ConversationList.tsx
|   |   |-- ConversationPanel.tsx
|   |   |-- ConversationHeader.tsx
|   |   |-- MessageBubble.tsx
|   |   |-- MessageComposer.tsx
|-- hooks/
|   |-- useWhatsAppConversations.ts
|   |-- useWhatsAppMessages.ts
|   |-- useWhatsAppRealtime.ts
|-- lib/
|   |-- whatsappConversations.ts
|   |-- whatsappMessages.ts
|   |-- whatsappMedia.ts
|   |-- whatsappQuickTasks.ts
|   |-- whatsappTickets.ts
|   |-- whatsappTypes.ts

supabase/
|-- functions/
|   |-- whatsapp-webhook/
|   |-- whatsapp-send-message/
|   |-- whatsapp-media/
|   |-- whatsapp-ticket-actions/
|   |-- whatsapp-ticket-automations/
|   |-- _shared/
|   |   |-- whatsapp-provider.ts
|   |   |-- whatsapp-ticket/
|   |   |   |-- interactive-messages.ts
|   |   |   |-- protocol.ts
|   |   |   |-- routing.ts
|   |   |   |-- task-chat.ts
|-- migrations/
|-- tests/
```

**Structure Decision**: Use the existing single Vite/React application and Supabase Edge Function layout. The improved flow is integration/business-rule work, so routing, idempotency, task creation, provider delivery decisions, contact linking validation, and office-hours rules stay in Edge Functions. React changes are limited to displaying the improved flow state, queue tabs, indicators, delivery failure alerts, and internal controls.

## Complexity Tracking

No constitution violations identified.

## Phase 0: Research

Research is captured in [research.md](./research.md), including fixed-flow scope, request-type routing, daily greeting idempotency, after-flow actions, after-hours queuing, provider failure handling, and bounded task consultation.

## Phase 1: Design & Contracts

Design artifacts:

- [data-model.md](./data-model.md)
- [contracts/whatsapp-message-flow.md](./contracts/whatsapp-message-flow.md)
- [contracts/whatsapp-actions.md](./contracts/whatsapp-actions.md)
- [quickstart.md](./quickstart.md)

## Constitution Check - Post Design

- [x] Security and least privilege remain satisfied: task consultation and creation require organization scope and linked-client validation.
- [x] Tenant isolation remains satisfied: all client-facing task data is bounded to the linked client.
- [x] Backend-owned business rules remain satisfied: flow routing, provider failure handling, and task creation are Edge Function responsibilities.
- [x] Scalable data access remains satisfied: task consultation uses bounded, filtered queries and message context is limited to active flow context.
- [x] Auditability remains satisfied: delivery failures, menu actions, task creation, attendance queueing, and flow endings are recorded.
