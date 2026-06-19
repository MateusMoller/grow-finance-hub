# Implementation Plan: Cargas Padrao de Obrigacoes por Regime Tributario

**Branch**: `003-obligation-regime-loads` | **Date**: 2026-06-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-obligation-regime-loads/spec.md`

## Summary

Reestruturar o catalogo nativo de obrigacoes para operar com um catalogo mestre unico e cargas padrao por regime tributario. A solucao deve aplicar automaticamente vinculos da carga ativa ao cadastrar empresa nova, aplicar condicionais apenas quando houver evidencia cadastral, nao gerar competencias automaticamente no cadastro, permitir ajustes individuais por cliente, sincronizar automaticamente alteracoes publicadas da carga para clientes existentes do mesmo regime sem alterar competencias ja geradas, suportar revisao em mudanca de regime e impedir duplicidades como criar varias obrigacoes FGTS para regimes diferentes. A regra critica ficara no backend do modulo nativo de obrigacoes; a UI exibira catalogo, cargas, sincronizacoes, revisoes, warnings e confirmacoes.

## Technical Context

**Language/Version**: TypeScript no frontend React 18/Vite; Supabase Edge Functions em TypeScript/Deno; SQL/Postgres em migrations. Ambiente alvo exige Node >=22.12.0.

**Primary Dependencies**: React Router, TanStack Query, shadcn/Radix, lucide-react, Supabase client, Supabase Edge Functions, Postgres/RLS.

**Storage**: Supabase Postgres. Tabelas existentes de base: `clients`, `obligation_templates`, `client_obligation_profiles`, `obligation_instances`, `expected_document_reference_files`. Novas estruturas planejadas: cargas por regime, itens da carga, metadados de origem/reaplicacao/sincronizacao, revisoes de condicionais e auditoria de aplicacao.

**Testing**: Vitest para regras de catalogo/deduplicacao/aplicacao/sincronizacao; testes de integracao para contratos da Edge Function; Playwright para fluxo de cadastro, catalogo, sincronizacao e mudanca de regime. Gates: `npm run lint`, `npm run test`, `npm run build`, `npm run verify:deploy`.

**Target Platform**: Web app interno em browser moderno; backend Supabase remoto/local; sem React Native.

**Project Type**: Web application com frontend interno, banco Supabase e Edge Function operacional.

**Performance Goals**: Aplicar carga de ate 150 obrigacoes a uma empresa em ate 5s; reconciliar ate 300 vinculos de uma empresa em ate 10s; sincronizar alteracoes de carga para clientes existentes de forma paginada/bounded sem bloquear a operacao; catalogo suportar 500 obrigacoes, 20 variacoes de carga e 10.000 vinculos por organizacao.

**Constraints**: Nao duplicar obrigacoes mestre; preservar historico de competencias/documentos/protocolos; nao gerar competencias, tarefas ou calendario no cadastro automatico; nao alterar competencias ja geradas em sincronizacoes de carga; nao aplicar remocoes silenciosas em mudanca de regime; regras sensiveis de deduplicacao, aplicacao, condicionalidade e sincronizacao nao podem depender apenas da tela.

**Scale/Scope**: Modulo interno de Obrigacoes, cadastro/edicao de Clientes, matriz/filial e snapshot de obrigacoes por cliente. Escopo inicial: Simples Nacional, Lucro Presumido, Lucro Real e MEI.

**Affected Surfaces**: Internal app, Supabase database, Edge Function `grow-obligations-module`, client registration flow, client detail flow, obligation catalog UI, obligation profile sync and obligation generation. Client portal apenas consome resultados ja autorizados; site publico nao afetado.

**Security/Tenant Scope**: Apenas usuarios internos autenticados podem visualizar catalogo/cargas; somente `admin`, `director` e `manager` podem gerenciar obrigacoes mestre, cargas e publicacao/sincronizacao de carga. Aplicacao/reaplicacao/sincronizacao deve validar JWT, organizacao ativa, roles, cliente da mesma organizacao, matriz/filial e feature flag `obrigacoes`. Portal clients e usuarios anonimos bloqueados.

**Business Rule Owner**: Edge Function `grow-obligations-module` e constraints/migrations do Supabase sao donos de normalizacao de regime, deduplicacao, avaliacao de condicionais, aplicacao da carga, sincronizacao automatica para clientes existentes, reconciliacao, criacao/atualizacao de vinculos e auditoria. Frontend fica responsavel por UX, preview, confirmacao quando exigida, warnings e invalidacao de cache.

**Observability/Rollback**: Auditoria para criar/editar/desativar obrigacao, carga, item da carga, aplicar carga, sincronizar clientes existentes e migrar regime. Migration com rollout em fases: tabelas/colunas nullable, seed idempotente, validacao, ativacao UI. Rollback deve desativar aplicacao/sincronizacao automatica e preservar vinculos/instancias historicas.

## Constitution Check

*GATE: Passed before Phase 0 research. Re-checked after Phase 1 design: Passed.*

### Security and Least Privilege

- [x] Public, internal, and client-portal surfaces remain separated by route, role, and backend authorization.
- [x] No secrets, service-role keys, OpenAI/WhatsApp/Open Finance/Acessorias credentials, or integration tokens are exposed to client code or logs.
- [x] Privileged operations validate JWT, organization, role, client access, action intent, and input shape before using service-role access.

### Tenant Isolation and Data Segregation

- [x] New or changed operational data is organization-aware.
- [x] Client portal flows enforce client-level access through `client_users` or existing obligation instance policies; no portal management of loads is introduced.
- [x] RLS, storage policies, and signed URL scope are addressed for affected tables/files. No new storage surface is required.

### Backend-Owned Business Rules

- [x] Authorization, synchronization, conditional applicability, deduplication, automation, obligation state, and migration rules live in the responsible backend layer.
- [x] Frontend-only rules are limited to display, filtering, draft forms and confirmation UX; backend revalidates all integrity-sensitive changes.

### Scalable Frontend and Data Access

- [x] Shared/repeated remote state uses TanStack Query and existing `invokeGrowObligations` pattern.
- [x] Independent requests start early and use grouped backend payloads to avoid waterfalls.
- [x] High-volume catalog/load views use server filtering plus `Map`/`Set` derived indexes for duplicate, condition and membership checks.
- [x] Public routes do not import internal-only obligation workflows.

### Auditability, Reliability, and Operability

- [x] Operational state changes have audit/logging coverage sufficient to identify actor, organization, client, action, source and sync run.
- [x] Application, sync and migration failures fail closed and return controlled UI errors.
- [x] Validation commands are identified: `npm run lint`, `npm run test`, `npm run build`, `npm run verify:deploy`.
- [x] Migrations that alter RLS, constraints, tenant scope, or critical tables include rollout and rollback considerations.

## Project Structure

### Documentation (this feature)

```text
specs/003-obligation-regime-loads/
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   |-- grow-obligations-actions.md
|   `-- ui-contract.md
|-- checklists/
|   `-- requirements.md
`-- tasks.md
```

### Source Code (repository root)

```text
src/
|-- components/
|   `-- obligations/
|       |-- GrowObligationsWorkspace.tsx
|       |-- ClientObligationsPanel.tsx
|       `-- regime-loads/
|-- hooks/
|   `-- obligations/
|-- lib/
|   |-- growObligations.ts
|   `-- obligations/
|       `-- [helpers for regimes, loads, conditional applicability, sync, duplicate diagnostics]
|-- pages/
|   |-- ClientsPage.tsx
|   `-- ClientDetailPage.tsx
`-- integrations/
    `-- supabase/
        `-- types.ts

supabase/
|-- functions/
|   |-- create-client-with-portal/
|   `-- grow-obligations-module/
`-- migrations/
    `-- [new migration for regime loads, sync runs, indexes, seed, RLS]

tests/
|-- unit/
|   `-- obligations/
|-- integration/
|   `-- obligations/
`-- e2e/
    `-- obligations/
```

**Structure Decision**: Evoluir o modulo nativo existente de Obrigacoes em vez de criar um modulo paralelo. A Edge Function `grow-obligations-module` continua sendo a fronteira de regras sensiveis; o frontend reutiliza `GrowObligationsWorkspace`, `ClientObligationsPanel`, `ClientsPage` e `ClientDetailPage` com componentes auxiliares para cargas por regime, warnings de condicionais, historico de sincronizacao e revisao de mudanca de regime.

## Complexity Tracking

Nenhuma violacao constitucional identificada. A complexidade adicional de tabelas de carga por regime, revisoes de sincronizacao e contratos backend e necessaria para impedir duplicidade, preservar historico, aplicar condicionais corretamente e manter aplicacao/sincronizacao automatica auditavel.
