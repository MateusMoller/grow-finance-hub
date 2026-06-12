# Implementation Plan: Reestruturacao Profissional do Modulo de Relatorios

**Branch**: `002-reports-module-restructure` | **Date**: 2026-06-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-reports-module-restructure/spec.md`

## Summary

Reestruturar o modulo interno de Relatorios para deixar de ser uma tela monolitica que carrega, transforma, valida e exporta dados no navegador, passando a operar com catalogo governado de datasets/campos, permissoes por papel e sensibilidade, filtros tenant-aware, modelos salvos validados, preview limitado, exportacao segura e auditoria de geracao. A abordagem tecnica separa regras de negocio em catalogo/servico compartilhado e backend confiavel quando houver dado sensivel, mantendo a UI responsiva com TanStack Query, estados por dataset e derivacoes indexadas.

## Technical Context

**Language/Version**: TypeScript 5.8, React 18, Node >=22.12.0, Supabase Edge Functions em Deno quando backend privilegiado for necessario.

**Primary Dependencies**: Vite, React Router, TanStack Query, Supabase JS, Tailwind, shadcn/Radix, lucide-react, sonner, xlsx para exportacao client-side de baixo risco quando aprovado.

**Storage**: Supabase Postgres para `saved_reports`, dados operacionais, auditoria e possiveis tabelas novas de catalogo/exportacao; Supabase Storage nao e superficie direta desta feature.

**Testing**: Vitest para unidades e contratos de catalogo/validacao; Playwright existente para fluxo de UI quando implementado; validacoes de entrega com `npm run lint`, `npm run test`, `npm run build` e, quando aplicavel, `npm run verify:deploy`.

**Target Platform**: Web app interno Vite/React em navegadores modernos, com Supabase como backend.

**Project Type**: Web application com frontend React, Supabase Postgres/RLS e Edge Functions para operacoes privilegiadas.

**Performance Goals**: Abrir o modulo sem bloquear por todos os datasets; busca em ate 500 campos com resposta visivel em ate 1s; preview sempre limitado; exportacoes acima do limite encaminhadas para fluxo controlado.

**Constraints**: Public site e portal do cliente nao podem importar ou receber datasets internos; nenhuma credencial ou segredo pode estar no bundle; autorizacao de exportacao deve ser revalidada no momento da geracao; modelos salvos continuam pessoais na primeira entrega.

**Scale/Scope**: Datasets iniciais: Clientes, Dados Cadastrais, Leads e CRM, Tarefas e Equipe. A arquitetura deve aceitar crescimento para centenas de campos, milhares de clientes/leads/tarefas e novas bases futuras.

**Affected Surfaces**: Internal app, Supabase database, Edge Functions, saved report persistence, report export flow, operational audit logs and organization feature flags. Public site and client portal are separation surfaces only.

**Security/Tenant Scope**: Internal roles only. Dataset and field access must consider active organization, user role, department/sector scope where applicable, client boundaries for client-scoped data and RLS. Client role is blocked for internal reports.

**Business Rule Owner**: Catalog metadata and non-sensitive UI composition live in `src/lib`/feature modules; permission checks, tenant scoping, sensitive export authorization, audit and volume limits must be enforced by Supabase RLS/RPC/Edge Function before sensitive data leaves the backend.

**Observability/Rollback**: Sensitive exports and model mutations emit operational audit events. Database migrations require rollback notes. UI shows controlled states for partial dataset failure, permission denied, empty result and export failure.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Security and Least Privilege

- [x] Public, internal, and client-portal surfaces remain separated by route, role, and backend authorization.
- [x] No secrets, service-role keys, OpenAI/WhatsApp/Open Finance/Acessorias credentials, or integration tokens are exposed to client code or logs.
- [x] Privileged operations validate JWT, organization, role, client access, action intent, and input shape before using service-role access.

### Tenant Isolation and Data Segregation

- [x] New or changed operational data is organization-aware.
- [x] Client portal flows enforce client-level access through `client_users` or a documented legacy fallback.
- [x] RLS, storage policies, and signed URL scope are addressed for affected tables/files.

### Backend-Owned Business Rules

- [x] Authorization, synchronization, deduplication, automation, completion, document classification, financial state, obligation state, and external integration rules live in the responsible backend layer.
- [x] Any frontend-only rule is non-sensitive, justified, and backed by backend validation where data integrity or access control matters.

### Scalable Frontend and Data Access

- [x] Shared/repeated remote state uses TanStack Query or a justified existing pattern.
- [x] Independent requests start early and use `Promise.all` where safe.
- [x] High-volume lists, filters, tables, and derived state use pagination, server filtering, indexing, `Map`/`Set`, virtualization, or another concrete scaling strategy.
- [x] Public routes avoid importing internal-only workflows or heavy dependencies.

### Auditability, Reliability, and Operability

- [x] Operational state changes have audit/logging coverage sufficient to identify actor, organization, client, action, and integration/automation.
- [x] Integration and webhook failures fail closed for sensitive actions and return controlled UI errors.
- [x] Validation commands are identified: `npm run lint`, `npm run test`, `npm run build`, `npm run verify:deploy`.
- [x] Migrations that alter RLS, constraints, tenant scope, or critical tables include rollout and rollback considerations.

## Project Structure

### Documentation (this feature)

```text
specs/002-reports-module-restructure/
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   |-- report-module-contract.md
|   `-- report-security-contract.md
`-- tasks.md
```

### Source Code (repository root)

```text
src/
|-- pages/
|   `-- RelatoriosPage.tsx
|-- components/
|   |-- app/
|   `-- reports/
|-- hooks/
|   |-- useAuth.tsx
|   |-- useGlobalFilters.ts
|   `-- useOrganizationSettings.ts
|-- integrations/
|   `-- supabase/
|-- lib/
|   |-- accessControl.ts
|   |-- globalFilters.ts
|   |-- operationalAudit.ts
|   `-- reports/
`-- test files colocados junto aos modulos ou em tests/ conforme padrao existente

supabase/
|-- migrations/
`-- functions/
    `-- report-exports/

tests/
|-- unit/
|-- integration/
`-- e2e/
```

**Structure Decision**: Manter o projeto Vite/React existente. Extrair a definicao de catalogo, classificacao, sanitizacao de modelos e montagem de linhas para `src/lib/reports/`; criar componentes menores em `src/components/reports/`; manter `RelatoriosPage.tsx` como composicao de pagina; usar Supabase migrations para persistencia/RLS/auditoria e Edge Function/RPC para exportacoes sensiveis ou acima do limite.

## Phase 0 Research Summary

See [research.md](./research.md). All planning unknowns were resolved with conservative defaults aligned to the current stack and constitution.

## Phase 1 Design Summary

See [data-model.md](./data-model.md), [quickstart.md](./quickstart.md) and contracts in [contracts/](./contracts/).

## Post-Design Constitution Check

### Security and Least Privilege

- [x] Route-level internal access remains required and backend/RLS checks are planned for catalog, saved models and sensitive exports.
- [x] Export contracts explicitly prohibit secrets and credential-like fields in direct reports.
- [x] The sensitive export contract requires JWT, organization, role, client/filter/field validation and controlled failure.

### Tenant Isolation and Data Segregation

- [x] Saved report models and export/audit events include `organization_id`.
- [x] Portal reports are out of scope; any future client report requires separate client-level contract through `client_users`.
- [x] RLS/index/migration tasks are required for changed persistence and audit surfaces.

### Backend-Owned Business Rules

- [x] Permission, sensitivity, volume, audit and export authorization are backend-owned for sensitive flows.
- [x] Frontend-only behavior is limited to UI composition, draft column ordering, non-sensitive preview state and presentation.

### Scalable Frontend and Data Access

- [x] TanStack Query is the planned cache/deduplication mechanism for dataset metadata, saved models and preview/export status.
- [x] Independent dataset loads are planned as separate queries, not one all-or-nothing load.
- [x] Catalog lookups and selected column validation use `Map`/`Set`; preview is bounded; export uses limits/background-safe path where needed.
- [x] Route-level lazy loading keeps reporting dependencies out of public routes.

### Auditability, Reliability, and Operability

- [x] Sensitive exports and model mutations have audit requirements.
- [x] Partial failure, permission denial and export failure have controlled UI states.
- [x] Validation commands are listed in quickstart.
- [x] Migration work must include rollout/rollback notes.

## Complexity Tracking

No constitution violations identified.
