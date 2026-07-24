# Implementation Plan: WhatsApp Ticket Automation

**Branch**: `010-whatsapp-ticket-automation` | **Date**: 2026-07-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/010-whatsapp-ticket-automation/spec.md`

## Summary

Evolve the existing WhatsApp client chat and Kanban task modules into a ticket-driven attendance flow. The system persists inbound WhatsApp messages idempotently, identifies authorized contacts, routes replies by quoted message, interactive ticket selection, protocol or active context, creates task/ticket records automatically only when classification confidence is at least 90%, and keeps the task chat as the auditable customer communication channel. Customer-facing selection uses official WhatsApp interactive messages, internal task attachments remain private until explicitly released to the customer, and active ticket context defaults to 24 hours after the last interaction.

## Technical Context

**Language/Version**: TypeScript on Vite React 18 for UI; Supabase Edge Functions on Deno/TypeScript; PostgreSQL SQL migrations.

**Primary Dependencies**: React, TypeScript, Tailwind, shadcn/Radix, lucide-react, TanStack Query, Supabase JS client, Supabase Edge Functions, Supabase Realtime and Storage.

**Storage**: Supabase Postgres for conversations, messages, tickets, task suggestions, task links, contexts, SLA records, audit logs and configuration; Supabase Storage for WhatsApp media and task/customer attachments.

**Testing**: `npm run lint`, `npm run test`, `npm run build`; focused unit tests for routing/status/SLA helpers; Edge Function tests where existing local function test patterns apply; manual quickstart validation against configured WhatsApp sandbox/production account.

**Target Platform**: Internal web app, Supabase backend, WhatsApp Cloud API integration, background automations.

**Project Type**: Web application with backend Edge Functions, database migrations, storage and external messaging integration.

**Performance Goals**: 95% of inbound messages persisted within 2 seconds; ticket list visible within 3 seconds for expected operational volumes; suggestion approval creates task/ticket within 60 seconds of user action; duplicate webhook processing avoided in 99.9% of repeated events.

**Constraints**: Secrets never reach Vite/browser code; WhatsApp interactive message and provider-window rules must be handled in backend; client-facing data must exclude internal comments/audit/priority; internal attachments are private by default and require explicit release; large message histories must be paginated; webhook processing must acknowledge safely without waiting on expensive classification.

**Scale/Scope**: Organization-scoped operational messaging for active clients, contacts, tickets, Kanban tasks, attachments, SLA alerts and reports. Scope includes supervised automation and high-confidence automatic task/ticket creation at 90% or more; unrestricted autonomous execution remains out of scope for v1.

**Affected Surfaces**: Internal app, WhatsApp module, Tarefas/Kanban detail, Supabase database, Edge Functions, Storage, automations/jobs, webhooks, Realtime, notifications, reports.

**Security/Tenant Scope**: Internal users require WhatsApp/Tarefas access by organization and sector where applicable. Contacts only see externally safe ticket state for authorized clients. Backend functions validate JWT, organization, module access, task/ticket/client ownership, action intent and confidence thresholds. RLS and storage policies are required for all new operational tables and files.

**Business Rule Owner**: Edge Functions and SQL own idempotency, client identification, context routing priority, official interactive WhatsApp payloads, automatic creation confidence thresholds, task/ticket creation, attachment release, status transitions, SLA clocks, reminders, closure, reopens and audit records. React owns presentation, form validation hints, optimistic UI and user feedback only.

**Observability/Rollback**: Persist webhook logs, conversation events, ticket events, task-message links and operational audit logs. Migrations must include rollback notes for disabling automations/routes before dropping tables. Failures remain visible with retry status and do not expose sensitive content.

## Constitution Check

*GATE: Passed before Phase 0 research. Re-checked after Phase 1 design.*

### Security and Least Privilege

- [x] Public, internal, and client-portal surfaces remain separated by route, role, and backend authorization.
- [x] No secrets, service-role keys, OpenAI/WhatsApp/Open Finance/Acessorias credentials, or integration tokens are exposed to client code or logs.
- [x] Privileged operations validate JWT, organization, role, client access, action intent, confidence threshold and input shape before using service-role access.

### Tenant Isolation and Data Segregation

- [x] New or changed operational data is organization-aware.
- [x] Client-facing WhatsApp flows enforce contact/client authorization before exposing ticket or company data.
- [x] RLS, storage policies, and signed URL scope are addressed for affected tables/files.

### Backend-Owned Business Rules

- [x] Authorization, synchronization, deduplication, automation, completion, classification, status and external integration rules live in the backend layer.
- [x] Frontend-only rules are limited to non-sensitive UI composition and backed by backend validation for integrity-sensitive changes.

### Scalable Frontend and Data Access

- [x] Shared/repeated remote state uses TanStack Query or existing query helpers.
- [x] Independent requests start early and use `Promise.all` where safe.
- [x] High-volume lists and histories use pagination, server filtering, indexes and bounded client-side derived state.
- [x] Public routes avoid importing internal-only workflows or heavy dependencies.

### Auditability, Reliability, and Operability

- [x] Operational state changes have audit/logging coverage sufficient to identify actor, organization, client, action and integration/automation.
- [x] Integration and webhook failures fail closed for sensitive actions and return controlled UI errors.
- [x] Validation commands are identified: `npm run lint`, `npm run test`, `npm run build`.
- [x] Migrations that alter RLS, constraints, tenant scope or critical tables include rollout and rollback considerations.

## Project Structure

### Documentation (this feature)

```text
specs/010-whatsapp-ticket-automation/
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   |-- edge-functions.md
|   |-- ui-contracts.md
|   `-- automation-events.md
|-- checklists/
|   `-- requirements.md
`-- tasks.md
```

### Source Code (repository root)

```text
src/
|-- components/
|   |-- app/
|   |   |-- KanbanTaskDetailSheet.tsx
|   |   `-- task/ticket-focused components as needed
|   `-- whatsapp/
|       |-- ConversationHeader.tsx
|       |-- ConversationList.tsx
|       |-- ConversationPanel.tsx
|       |-- MessageBubble.tsx
|       |-- MessageComposer.tsx
|       `-- ticket/context/triage components as needed
|-- hooks/
|   |-- useWhatsAppConversations.ts
|   |-- useWhatsAppMessages.ts
|   `-- useWhatsAppTickets.ts
|-- lib/
|   |-- whatsappConversations.ts
|   |-- whatsappMessages.ts
|   |-- whatsappMedia.ts
|   |-- whatsappTickets.ts
|   |-- ticketRouting.ts
|   |-- ticketSla.ts
|   `-- taskSuggestions.ts
`-- pages/
    |-- WhatsAppAtendimentoPage.tsx
    |-- TarefasPage.tsx
    `-- RelatoriosPage.tsx

supabase/
|-- migrations/
|   `-- YYYYMMDDHHMMSS_whatsapp_ticket_automation.sql
|-- functions/
|   |-- whatsapp-webhook/
|   |-- whatsapp-send-message/
|   |-- whatsapp-media/
|   |-- whatsapp-ticket-actions/
|   |-- whatsapp-ticket-automations/
|   `-- _shared/
|       |-- whatsapp-*.ts
|       |-- whatsapp-ticket/
|       |   |-- audit.ts
|       |   |-- classification.ts
|       |   |-- contact-matching.ts
|       |   |-- interactive-messages.ts
|       |   |-- protocol.ts
|       |   |-- routing.ts
|       |   |-- sla.ts
|       |   `-- types.ts
`-- tests/
    `-- whatsapp-ticket-automation/
```

**Structure Decision**: Extend the existing Vite React + Supabase structure. Do not create a separate service or standalone ticket application. Backend-critical rules are added to Supabase migrations/functions and consumed by existing WhatsApp, Kanban and reporting pages/components.

## Complexity Tracking

No constitution violations identified. Complexity is justified by the feature spanning webhook ingestion, customer communication, official WhatsApp interactive messages, task creation, ticket state, SLA and audit; each sensitive rule remains in the owning backend layer.
