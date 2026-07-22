# Implementation Plan: Pipeline de Vendas Comercial

**Branch**: `009-sales-pipeline` | **Date**: 2026-07-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-sales-pipeline/spec.md`

## Summary

Reformular o modulo Vendas para operar como pipeline comercial completo, permitindo gerir oportunidades por etapa, vender servicos contabeis e produtos avulsos, vincular cliente existente ou cadastrar lead/cliente novo, registrar follow-ups, historico, resultados e indicadores. A abordagem tecnica sera evoluir o modulo interno existente em `/app/crm`, preservar dados atuais de `crm_leads`, adicionar modelo comercial mais expressivo, permitir etapas e catalogo comercial editaveis por administradores/gestores, e manter regras criticas de permissao, tenant scope, auditoria, deduplicacao e criacao automatica de cliente/tarefa no backend/Supabase.

## Technical Context

**Language/Version**: TypeScript 5.8, React 18, Vite 8, SQL PostgreSQL/Supabase

**Primary Dependencies**: React Router, TanStack Query, Supabase JS, shadcn/Radix, lucide-react, date-fns, zod

**Storage**: Supabase PostgreSQL com RLS; tabelas comerciais existentes `crm_leads`, `crm_goals`, `crm_lead_events`; novas tabelas ou colunas para oportunidades, produtos/ofertas, etapas configuraveis, atividades, vinculos com clientes, leads comerciais e referencia para tarefas de complementacao cadastral

**Testing**: `npm run lint`, `npm run test`, `npm run build`; validacao manual do fluxo no app interno

**Target Platform**: Web app interno Grow Finance Hub

**Project Type**: Aplicacao web interna com backend Supabase

**Performance Goals**: Tela principal de vendas carregando pipeline e indicadores em ate 3 segundos; filtros/busca percebidos em ate 1 segundo; suporte planejado para 10.000 oportunidades por organizacao

**Constraints**: Dados comerciais devem ser organization-aware; acesso somente para usuarios internos autorizados; regras de permissao e integridade nao podem depender apenas da tela; nao expor dados no portal do cliente nesta fase

**Scale/Scope**: Um modulo principal de Vendas, detalhe de oportunidade, cadastro/edicao de oportunidade, cadastro rapido de lead/cliente comercial, catalogo padrao editavel de produtos/servicos com opcao "Outro", etapas padrao editaveis, indicadores, filtros, historico, atividades e automacao de cliente pendente/tarefa ao ganhar oportunidade de cliente novo

**Affected Surfaces**: Internal app, Supabase database, RLS, audit/history records, generated TypeScript database types, Tarefas/Kanban for complementacao cadastral, Clientes for cadastro pendente, reports/commercial data references when applicable

**Security/Tenant Scope**: Usuarios com modulo `crm`/Vendas e papel interno autorizado podem ler e operar vendas dentro da organizacao ativa. Apenas administradores/gestores gerenciam etapas e catalogo comercial. Dados de cliente seguem limites da organizacao atual. Portal do cliente e site publico nao recebem acesso a oportunidades comerciais.

**Business Rule Owner**: Supabase migration/RLS para tenant scope e permissao; banco/funcao RPC ou Edge Function para constraints, deduplicacao, auditoria minima e criacao atomica de cliente pendente/tarefa; frontend para UX, filtros, formularios, estados visuais e orquestracao; TanStack Query para cache/invalidation.

**Observability/Rollback**: Historico comercial em eventos/atividades por oportunidade; auditoria operacional para criacao, alteracao, ganho, perda, reabertura, exclusao/arquivamento, gestao de etapas/catalogo e criacao automatica de cliente/tarefa; rollback por migration reversivel sem apagar `crm_leads` existentes.

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
- [x] Validation commands are identified: `npm run lint`, `npm run test`, `npm run build`.
- [x] Migrations that alter RLS, constraints, tenant scope, or critical tables include rollout and rollback considerations.

## Project Structure

### Documentation (this feature)

```text
specs/009-sales-pipeline/
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   |-- sales-pipeline-ui.md
|   `-- sales-pipeline-data-access.md
`-- tasks.md
```

### Source Code (repository root)

```text
src/
|-- pages/
|   `-- CRMPage.tsx
|-- components/
|   `-- app/
|       |-- SalesCatalogManager.tsx
|       |-- SalesOpportunityDialog.tsx
|       |-- SalesOpportunityDetailSheet.tsx
|       |-- SalesPipelineSettingsDialog.tsx
|       |-- SalesPipelineBoard.tsx
|       `-- SalesPipelineMetrics.tsx
|-- lib/
|   |-- salesPipeline.ts
|   |-- operationalAudit.ts
|   `-- userPermissions.ts
|-- integrations/
|   `-- supabase/
|       |-- client.ts
|       `-- types.ts
`-- App.tsx

supabase/
`-- migrations/
    `-- [timestamp]_extend_sales_pipeline.sql
```

**Structure Decision**: Evoluir a rota interna existente `/app/crm`, mantendo o nome visual "Vendas". A tela densa deve ser quebrada em componentes estaveis sob `src/components/app/` e helpers de dados em `src/lib/salesPipeline.ts`. O backend persistente fica em migration Supabase com RLS, indices e operacao atomica para ganhar oportunidade de cliente novo, criar cliente pendente e gerar tarefa Comercial. Nenhum novo projeto ou dependencia e necessario.

## Phase 0: Research

See [research.md](./research.md).

## Phase 1: Design & Contracts

See [data-model.md](./data-model.md), [quickstart.md](./quickstart.md), and [contracts/](./contracts/).

## Complexity Tracking

No constitution violations identified. No added architectural complexity beyond evolving the existing Vendas/CRM module and Supabase schema.
