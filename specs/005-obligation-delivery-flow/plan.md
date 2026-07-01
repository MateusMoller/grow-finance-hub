# Implementation Plan: Obligation Delivery Flow

**Branch**: `005-obligation-delivery-flow` | **Date**: 2026-06-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-obligation-delivery-flow/spec.md`

## Summary

Improve the existing Grow obligations flow instead of rebuilding it: keep the current obligation catalog, client profiles, generated obligation instances, document inbox, robot ingestion pipeline, storage bucket, and email delivery pieces, then close the reliability gaps that prevent end-to-end delivery. The main correction is to make "confirmed and sent to client" the completion boundary: a guide can be matched, attached, and prepared before completion, but the obligation task/instance should close only after an authorized user explicitly confirms sending and the client email succeeds.

The implementation should consolidate business rules in Supabase/Edge Functions, preserve existing records, make retry and manual review explicit, and keep the React workspace focused on queue visibility, review, recipient review/edit, and controlled send/retry actions.

## Technical Context

**Language/Version**: TypeScript 5.8, React 18, Vite 8, Supabase Edge Functions on Deno, PostgreSQL migrations.

**Primary Dependencies**: Supabase JS 2.99, TanStack Query 5, shadcn/Radix UI, lucide-react, zod, existing Resend HTTP integration, existing local Grow document robot pipeline.

**Storage**: Supabase Postgres tables for obligations, tasks, document inbox, delivery events, audits, and delivery review flags; Supabase Storage bucket `obligation-files` for templates and guides.

**Testing**: `npm run lint`, `npm run test`, `npm run build`, `npm run verify:deploy`; targeted Vitest coverage for frontend helpers; SQL tests where RLS/state transitions are changed; Edge Function verification through local or remote invocation.

**Target Platform**: Internal web app and Supabase backend. No React Native/mobile scope.

**Project Type**: Vite React web app with Supabase database, Storage, and Edge Functions.

**Performance Goals**: Support 5,000 active clients, 500 obligation templates, 100,000 delivery records per organization, and batch document upload/processing of at least 100 files with per-file status.

**Constraints**: Do not rebuild parallel modules. Reuse existing tables and screens when safe. Sensitive matching, deduplication, recipient validation, task completion, email sending, and audit rules must be backend-owned. Client email delivery must use a verified Grow `From` address; the authenticated final sender's registered email must be used for reply-to, displayed sender context, and audit identity.

**Scale/Scope**: Internal obligation catalog, Central de Documentos, document robot ingestion, operational task/instance tracking, human-confirmed client email delivery, retry/audit history, and reconciliation of existing records.

**Affected Surfaces**: Internal app, Supabase database, Edge Functions, Storage, local robot/document ingestion, email integration, task/Kanban workflows, audit/event history. Client portal is affected only if existing delivery history/document visibility is reused.

**Security/Tenant Scope**: Internal roles only for catalog management, upload, review, send, retry, and cancellation. All records must remain organization-aware and client-scoped. Service-role operations stay inside Edge Functions. Storage access uses private bucket policies and short-lived signed URLs when downloads are needed.

**Business Rule Owner**: Edge Function and database constraints own authorization, matching state, idempotency, recipient validation, send/retry, task/instance completion, audit, and status transitions. React owns UX state, filtering, previews, recipient review/edit, confirmation prompts, and cache invalidation only.

**Observability/Rollback**: `obligation_instance_events`, delivery attempt records/events, document ingestion status fields, delivery review flags for historical completed records without email evidence, controlled error messages, and migration rollback notes. Existing data must be reconciled without deleting valid records or reopening historical completions automatically.

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
      `npm run build`, or `npm run verify:deploy`.
- [x] Migrations that alter RLS, constraints, tenant scope, or critical tables
      include rollout and rollback considerations.

## Project Structure

### Documentation (this feature)

```text
specs/005-obligation-delivery-flow/
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   |-- edge-function-actions.md
|   `-- state-transitions.md
`-- tasks.md
```

### Source Code (repository root)

```text
src/
|-- components/
|   `-- obligations/
|       |-- GrowObligationsWorkspace.tsx
|       `-- ClientObligationsPanel.tsx
|-- lib/
|   |-- obligations/
|   |   |-- obligationAudit.ts
|   |   |-- obligationDeduplication.ts
|   |   |-- regimeLoadContracts.ts
|   |   `-- regimeLoadTypes.ts
|   |-- documentRecognition.ts
|   |-- taskOrigin.ts
|   `-- taskSectorAccess.ts
`-- test/
    |-- taskSectorRouting.test.ts
    `-- obligationDeliveryFlow.test.ts

supabase/
|-- functions/
|   |-- grow-obligations-module/
|   |   `-- index.ts
|   |-- obligation-document-processor/
|   |   `-- index.ts
|   `-- _shared/
|       `-- user-permissions.ts
|-- migrations/
|   `-- <new obligation delivery reliability migration>.sql
`-- tests/
    |-- user_permissions_task_access.sql
    `-- obligation_delivery_flow.sql

tools/
`-- grow-document-robot/
    |-- src/
    `-- runtime/
```

**Structure Decision**: Use the existing single Vite app plus Supabase backend layout. The feature should improve `GrowObligationsWorkspace.tsx`, `grow-obligations-module`, `obligation-document-processor`, and existing obligation/document tables rather than adding a new app or duplicate delivery service.

## Phase 0: Research

See [research.md](./research.md).

Key decisions:

- Preserve the existing native obligations module and extend it in place.
- Treat explicit human confirmation plus successful client email delivery as the only completion boundary.
- Represent send/retry/audit as durable backend state, not only event comments.
- Keep document templates as reference/extraction files and guide files as delivery attachments.
- Use explicit manual review for low-confidence or conflicting matches.
- Preserve historical completed records without email evidence and flag them for delivery review/audit.

## Phase 1: Design And Contracts

See [data-model.md](./data-model.md), [contracts/edge-function-actions.md](./contracts/edge-function-actions.md), [contracts/state-transitions.md](./contracts/state-transitions.md), and [quickstart.md](./quickstart.md).

Design output:

- Extend current data semantics around obligation instances, document inbox items, ingestion jobs, instance files, delivery attempts, and delivery review flags.
- Add or formalize backend actions for prepare/send/retry delivery while preserving existing upload, preview, process, and resolve actions; processing may prepare delivery but must not auto-send.
- Make task/instance completion dependent on human-confirmed delivery success.
- Keep React UI as an operational command surface with server-backed statuses, recipient review/edit, and controlled errors.

## Post-Design Constitution Check

### Security and Least Privilege

- [x] Public and client portal routes remain outside this internal delivery workflow unless existing portal history is explicitly reused.
- [x] Resend/API credentials remain Edge Function-only.
- [x] Send/retry/complete actions validate JWT, organization, internal role/module access, target client, primary or reviewed recipient email, target obligation, and document status.

### Tenant Isolation and Data Segregation

- [x] Delivery records, attempts, document inbox rows, files, and tasks are organization-aware and client-scoped.
- [x] Storage paths remain under `obligation-files` with internal policies and scoped signed URL generation only where needed.
- [x] Existing data reconciliation must backfill missing organization/client references before enabling stricter gates.

### Backend-Owned Business Rules

- [x] Deduplication, matching acceptance, recipient validation, send idempotency, retry, and task completion are backend rules.
- [x] Frontend validation is only a fast user feedback layer; backend revalidates every sensitive state change.

### Scalable Frontend and Data Access

- [x] Workspace data continues through TanStack Query mutations and invalidation.
- [x] High-volume queues require server filters/pagination and local `Map`/`Set` indexes for current page derivations.
- [x] No public route imports the internal obligations workspace.

### Auditability, Reliability, and Operability

- [x] Delivery attempts and instance events provide actor, verified sender address, reply-to user email, recipient, client, obligation, competence, result, provider id/error, review flags, and timestamps.
- [x] Email failure keeps the task/instance open and returns a controlled retryable state.
- [x] Historical completed records without email-sent evidence keep their historical status and receive delivery review/audit classification.
- [x] Validation gates remain `npm run lint`, `npm run test`, `npm run build`, and `npm run verify:deploy`.
- [x] Migrations include additive rollout, reconciliation, and rollback guidance.

## Complexity Tracking

No constitution violations are expected. The design intentionally improves existing modules instead of adding parallel services.
