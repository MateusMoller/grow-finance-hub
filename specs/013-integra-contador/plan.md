# Implementation Plan: DCTFWeb assistida dentro das tarefas

**Branch**: `013-integra-contador` | **Date**: 2026-08-21 | **Spec**: `specs/013-integra-contador/spec.md`

## Summary

Adicionar a DCTFWeb como domínio derivado do Integra Contador, operado dentro da tarefa canônica de cada cliente. O primeiro incremento será de consulta e emissão: identificar a declaração da competência, consultar XML/recibo/relatório, gerar DARF de declaração transmitida ou guia em andamento e persistir os documentos. A transmissão ficará atrás de feature flag e confirmação humana, sendo liberada somente após validação do XML assinado, procuração, catálogo contratado e transporte produtivo.

O cenário Trial oficial documenta `DCTFWEB` versão `1.0` com: `GERARGUIA31`, `GERARGUIAANDAMENTO313`, `CONSRECIBO32`, `CONSDECCOMPLETA33`, `CONSXMLDECLARACAO38` e `TRANSDECLARACAO310`.

## Technical Context

**Language/Version**: React 18, TypeScript 5.8, Deno Edge Functions, PostgreSQL/Supabase  
**Primary Dependencies**: Vite, TanStack Query, Supabase JS/CLI, shadcn/Radix  
**Storage**: PostgreSQL tenant-scoped metadata plus private `obligation-files` storage  
**Testing**: Vitest, Deno contract tests, Supabase SQL/RLS tests, Playwright  
**Target Platform**: Grow Finance web app and Supabase backend  
**Project Type**: Web application with Edge Functions and external fiscal provider  
**Performance Goals**: task context p95 <= 2 s from local state; external request never blocks unrelated task data; one provider call per explicit action  
**Constraints**: no browser-to-SERPRO call; no automatic transmission; XML/base64 excluded from logs; idempotent document generation; existing task/obligation remains canonical  
**Scale/Scope**: monthly DCTFWeb tasks for eligible clients, initially Trial and organization feature-flagged  
**Affected Surfaces**: internal task sheet, obligations, Edge Function, database, private Storage, Integra Contador/SERPRO  
**Security/Tenant Scope**: internal authorized users only; organization/client/task/instance checked server-side; signed URLs short-lived; provider credentials/certificates backend-only  
**Business Rule Owner**: Edge Function and database workflow own eligibility, state, deduplication and completion; React only renders and confirms actions  
**Observability/Rollback**: provider operation/audit events, request tags and sanitized errors; feature flag disables DCTFWeb independently; additive migration with reversible policies/indexes

## Constitution Check

### Pre-design gate

- **Security and least privilege**: PASS — provider access remains authenticated and backend-only.
- **Tenant isolation**: PASS — every dossier, operation and artifact is scoped by organization and client.
- **Backend-owned rules**: PASS — task eligibility, state transitions, hashes and external effects are server-controlled.
- **Scalable frontend**: PASS — task-scoped TanStack Query, lazy panel and targeted invalidation.
- **Auditability**: PASS — all external operations and approvals receive actor, task, instance and request correlation.
- **Specification scope**: **CONDITIONAL** — current `spec.md` explicitly excludes DCTFWeb transmission and mass DARF emission. Before implementation, amend the specification for this derived increment. This plan does not authorize bulk issuance or unattended transmission.

### Post-design gate

PASS for the consultation/emission slice. Transmission remains gated by the specification amendment and the external-contract checks listed below.

## Official service mapping

| Capability | Route | Service | Required business input | Initial release |
|---|---|---|---|---|
| Generate DARF for transmitted declaration | `/Emitir` | `GERARGUIA31` | category, year/month, receipt number | Yes, after receipt selection |
| Generate guide for in-progress declaration | `/Emitir` | `GERARGUIAANDAMENTO313` | category, year/month | Yes, explicit action |
| Consult receipt | `/Consultar` | `CONSRECIBO32` | category, year/month, receipt number | Yes |
| Consult complete report | `/Consultar` | `CONSDECCOMPLETA33` | category, year/month, receipt number | Yes |
| Consult declaration XML | `/Consultar` | `CONSXMLDECLARACAO38` | category, year/month | Yes |
| Transmit declaration | `/Declarar` | `TRANSDECLARACAO310` | category, year/month, signed XML base64 | Feature flag, later gate |

`categoria` must be modeled as a domain value instead of copied as an inconsistent string/number from examples. Exact production catalog/version, allowed categories and required procuração remain `EXTERNAL_CONTRACT_PENDING`.

## Architecture and flow

1. A canonical DCTFWeb template/profile generates the monthly obligation instance and task.
2. Opening that task calls `get_task_dctfweb_context`; the backend validates tenant, task origin, instance, client and template.
3. The backend creates or reuses exactly one DCTFWeb dossier for `(organization, client, competence, category)` and links it to the instance.
4. The task panel shows provider state and prerequisite checklist: competence, category, eSocial/EFD-Reinf closure evidence, XML availability and authorization.
5. Read actions consult XML, receipt or report and persist normalized metadata; raw XML/document bytes go only to private Storage when needed.
6. DARF generation requires explicit user action and a deterministic idempotency key. The resulting PDF is hashed, stored once and linked to the obligation instance.
7. Transmission requires a valid approved data version, signed XML hash, second confirmation, production feature flag and current authorization. No retry occurs after an ambiguous timeout until provider state is consulted.
8. The obligation/task completes only after the configured required artifacts exist. Ambiguous or blocked states keep the task open with a concrete action.

## State model

`collecting -> ready_for_review -> approved -> consulting/transmitting -> transmitted -> documents_issued -> completed`

Exception states: `requires_action`, `authorization_blocked`, `external_processing`, `transmission_unknown`, `failed_retryable`, `failed_final`. Any edit after approval increments `data_version` and invalidates approval.

## Implementation phases

### Phase A — Contract and foundation

- Amend the feature specification and domain checklist for DCTFWeb.
- Add DCTFWeb provider adapter and typed Trial fixtures for all six services.
- Add canonical category/competence serializers and safe response/error mapping.
- Add tenant-scoped dossier, operation and artifact metadata with RLS and indexes.

### Phase B — Read-only task workflow

- Recognize canonical DCTFWeb tasks without changing other task types.
- Prepare/reuse the dossier from the task instance.
- Consult XML, receipt and complete report; show status and prerequisites in the task.
- Store immutable artifacts privately and expose only two-minute signed URLs.

### Phase C — Assisted DARF issuance

- Support transmitted (`GERARGUIA31`) and in-progress (`GERARGUIAANDAMENTO313`) paths.
- Require confirmation, idempotency key and state revalidation immediately before the call.
- Link DARF to `obligation_instance_files`; do not duplicate an identical document.
- Keep financial reconciliation outside this slice.

### Phase D — Controlled transmission

- Add signed XML upload/source contract, MIME/size/hash validation and approval versioning.
- Enable `TRANSDECLARACAO310` only under organization/domain production flag.
- On timeout, enter `transmission_unknown` and consult state before any new attempt.
- Persist receipt/report and complete the canonical delivery only through the obligations backend contract.

### Phase E — Operations and rollout

- Add usage, latency, provider code, cache/idempotency and error telemetry.
- Trial pilot with selected clients; then read-only production; then DARF; transmission last.
- Kill switch disables DCTFWeb while leaving PGDAS-D, DEFIS and other modules operational.

## Project Structure

```text
src/features/integra-contador/
├── components/TaskDctfwebPanel.tsx
├── hooks/useTaskDctfwebDossier.ts
├── api.ts
└── types.ts
supabase/functions/_shared/integra-contador/domains/dctfweb/
├── client.ts
├── contracts.ts
└── client_test.ts
supabase/functions/integra-contador-module/index.ts
supabase/migrations/<generated>_add_dctfweb_task_workflow.sql
supabase/tests/dctfweb_task_workflow.sql
tests/unit/integraContador/dctfwebContract.test.ts
tests/e2e/dctfweb-task-workflow.spec.ts
```

The existing `KanbanTaskDetailSheet`, obligation engine, audit helper and private `obligation-files` bucket are reused. No new top-level module or parallel task queue is introduced.

## Test strategy

- Unit: envelope/route/service IDs, category/period normalization, base64 boundaries and error classification.
- Contract: all official Trial scenarios with sanitized fixtures.
- SQL/RLS: cross-tenant denial, unique dossier, state transitions, immutable artifact hash and idempotent generation.
- Edge Function: JWT/organization/task checks, unsupported template rejection and feature-flag gates.
- Integration: task -> consultation -> DARF -> artifact link without duplicate task or obligation.
- E2E: responsive task panel, warnings, confirmation, retry-safe error and download.
- Regression: PGDAS-D, DEFIS and generic tasks render and operate unchanged.
- Quality gate: `npm run verify:deploy`, Deno tests and Supabase SQL tests.

## Rollout and rollback

- Default feature flag off; Trial only for the first pilot.
- Migration is additive and does not rewrite existing task/obligation data.
- Rollback disables the DCTFWeb capability and removes UI access; stored audit and fiscal artifacts remain immutable for retention.
- Table/function removal occurs only in a later cleanup migration after confirming no retained references.

## External contract pending

- Contracted production service IDs/versions and billing.
- Accepted categories and type representation for each service.
- Required e-CAC procurações and author/contractor arrangement.
- Source and signing responsibility for `xmlAssinadoBase64`.
- Response MIME/encoding, maximum sizes, asynchronous semantics and rate limits.
- Whether `GERARGUIAANDAMENTO313` is acceptable in the Grow operational policy.

## Complexity Tracking

No new framework, queue or standalone module is justified. DCTFWeb is another provider domain using the existing task, obligation, Storage, audit and Integra Contador foundations.
