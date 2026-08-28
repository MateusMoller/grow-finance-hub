# Implementation Plan: Revisão das permissões de tarefas

**Branch**: `012-review-task-permissions` | **Date**: 2026-08-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-review-task-permissions/spec.md`

## Summary

Consolidar as permissões do módulo de tarefas em uma matriz canônica de capacidades, mantendo RLS para leitura e isolamento de tenant e centralizando mutações sensíveis em operações backend autorizadas por ação e recurso. O trabalho remove políticas e privilégios legados sobrepostos, protege funções auxiliares, valida automações privilegiadas contra a tarefa específica, torna auditoria e mutação atômicas, migra usuários remanescentes do modelo legado e alinha Kanban, Lista, Calendário, notificações e painel lateral ao mesmo contrato de capacidades.

## Technical Context

**Language/Version**: TypeScript 5.8, React 18.3, Deno/TypeScript nas Edge Functions, PostgreSQL do projeto Supabase

**Primary Dependencies**: Vite 8, React Router 6, TanStack Query 5, Supabase JS 2.99, shadcn/Radix, Zod 3, Vitest 4

**Storage**: PostgreSQL/Supabase (`kanban_tasks`, `kanban_task_comments`, `kanban_task_relations`, `organization_user_access`, `user_module_grants`, `operational_audit_logs`)

**Testing**: Vitest para domínio/UI/contratos, pgTAP em `supabase/tests` para funções e RLS, testes Deno existentes para automações, verificação dos advisors de segurança

**Target Platform**: Aplicação web responsiva e Supabase Edge Functions

**Project Type**: Aplicação web com frontend React, banco acessível por API e funções backend privilegiadas

**Performance Goals**: p95 de leitura visual abaixo de 2 segundos com 10.000 tarefas por organização; confirmação ou negação de mutação em até 1 segundo; revogação efetiva em até 60 segundos

**Constraints**: negação por padrão; sem filtragem sensível somente no frontend; nenhuma operação global fora de RLS para papéis da aplicação; compatibilidade legada temporária e observável; preservação das integrações de obrigações, WhatsApp e Acessórias

**Scale/Scope**: todas as entradas internas de tarefas, 3 papéis canônicos, 6 setores, 15+ capacidades, tarefas manuais e automáticas, comentários, relações, auditoria e operações em lote

**Affected Surfaces**: aplicativo interno, Supabase database/RLS, Edge Functions, automações/webhooks, WhatsApp, obrigações, Acessórias, calendário, notificações e relatórios; portal apenas como origem controlada

**Security/Tenant Scope**: administrador restrito à organização ativa; colaborador ativo exige módulo `tarefas` e setor compatível para leitura; cliente não acessa tarefa interna; mutações exigem capacidade explícita; serviço privilegiado revalida JWT, organização, tarefa e ação

**Business Rule Owner**: banco/RLS é dono do isolamento e leitura; uma operação backend canônica é dona de mutações sensíveis e auditoria; Edge Functions de integração chamam essa operação ou um helper interno equivalente; frontend apenas consulta capacidades e apresenta ações

**Observability/Rollback**: `operational_audit_logs` registra sucesso, negação e falha; métricas por ação/origem; migração em fases com inventário legado, shadow checks e feature flag de enforcement; rollback restaura a versão anterior das políticas sem reabrir privilégios anônimos/globais

**Tooling Note**: a instalação atual do Spec Kit não contém `update-agent-context.ps1`; o contexto foi atualizado manualmente apenas no bloco `SPECKIT` de `AGENTS.md`.

## Constitution Check

*GATE: Passed before research and re-checked after design.*

### Security and Least Privilege

- [x] Superfícies pública, interna e portal permanecem separadas; tarefas são internas.
- [x] Nenhum segredo ou service-role será exposto ao cliente ou aos logs.
- [x] Operações privilegiadas validarão JWT, organização, papel, tarefa, ação e entrada.

### Tenant Isolation and Data Segregation

- [x] Todas as entidades e contratos são vinculados à organização.
- [x] Portal não recebe acesso direto a tarefas; origens do portal são convertidas por backend autorizado.
- [x] RLS de tarefas, comentários, relações e auditoria está no escopo do desenho.

### Backend-Owned Business Rules

- [x] Autorização, mutações sensíveis, automações e auditoria serão backend-owned.
- [x] Frontend mantém apenas apresentação e feedback, sempre apoiado por validação backend.

### Scalable Frontend and Data Access

- [x] Consultas do módulo serão paginadas, filtradas no servidor e cacheadas por organização/escopo.
- [x] Validações independentes nas funções serão iniciadas em paralelo quando seguro.
- [x] Índices existentes serão revisados para organização, status, setor, responsável e integrações.
- [x] Rotas públicas não são afetadas.

### Auditability, Reliability, and Operability

- [x] Mutação e auditoria ocorrerão na mesma transação para ações sensíveis.
- [x] Automações falharão fechadas e retornarão erros controlados.
- [x] Gates: `npm run lint`, `npm run test`, `npm run build`, testes pgTAP, testes Deno e advisors.
- [x] Migrações RLS incluem rollout, verificação e rollback documentados.

## Architecture and Delivery Phases

### Phase A — Contenção imediata

1. Remover a política legada paralela de DELETE em `kanban_tasks`.
2. Revogar `TRUNCATE`, `TRIGGER` e `REFERENCES` de `anon` e `authenticated` nas tabelas de tarefas.
3. Revogar execução anônima/PUBLIC de helpers `SECURITY DEFINER`, especialmente `can_access_task_sector`.
4. Adicionar testes pgTAP que falham caso políticas ou grants proibidos reapareçam.

### Phase B — Núcleo canônico de capacidades

1. Definir enumeração estável de ações (`task.read`, `task.create`, `task.update_content`, `task.change_status`, `task.assign`, `task.change_sector`, `task.archive`, `task.delete`, `task.comment`, `task.relate`).
2. Criar helper privado de decisão que deriva capacidades do acesso canônico e do estado atual da tarefa.
3. Manter políticas de SELECT enxutas; bloquear UPDATE/DELETE diretos sensíveis e expor mutação canônica autenticada.
4. Validar campos permitidos por ação, estado anterior, estado seguinte e escopo do responsável.

### Phase C — Auditoria atômica

1. Executar autorização, lock da tarefa, mutação e auditoria numa transação.
2. Registrar `before`, `after`, campos alterados, ator, origem, organização, resultado e correlação.
3. Registrar negações de alto risco por uma entrada backend segura, sem expor conteúdo proibido.
4. Substituir gravações best-effort do frontend nas ações cobertas.

### Phase D — Integrações privilegiadas

1. Inventariar cada escrita em `kanban_tasks` por WhatsApp, obrigações, Acessórias, calendário, CRM e assistente.
2. Distinguir ator humano delegado de ator de sistema.
3. Para ações em nome do usuário, exigir capacidade sobre a tarefa; para jobs do sistema, exigir origem allowlisted, organização e vínculo técnico idempotente.
4. Impedir que falha na atualização da tarefa seja ignorada após conclusão de ticket ou obrigação.

### Phase E — Migração do legado

1. Gerar relatório de usuários com papel legado sem `organization_user_access` canônico.
2. Criar/confirmar os acessos canônicos e módulos necessários, sem ampliar permissões.
3. Ativar shadow check que compara decisão canônica e legada e audita divergências.
4. Após período sem divergências críticas, remover fallback legado das funções de tarefas.

### Phase F — UX e consultas

1. Criar contrato de capacidades por tarefa/escopo para esconder ou desabilitar ações de forma consistente.
2. Aplicar a Kanban, Lista, Calendário, detalhe, notificações, relatórios e links diretos.
3. Migrar consultas para TanStack Query com chaves por organização e filtros; invalidar imediatamente após revogação/mutação.
4. Paginar e filtrar no servidor; nunca baixar tarefas fora do escopo para filtrar localmente.

### Phase G — Verificação e rollout

1. Rodar matriz com 100+ cenários negativos e positivos.
2. Medir latência com 10.000 tarefas e validar índices por plano de consulta.
3. Publicar por fases: contenção, shadow mode, enforcement, remoção do legado.
4. Monitorar negações, divergências, falhas de integração e auditorias ausentes.

## Migration Strategy

1. Criar migração via `supabase migration new harden_task_permissions`.
2. Na mesma entrega, adicionar testes pgTAP de políticas, grants e helpers.
3. Aplicar primeiro a contenção compatível: remover política ampla e grants globais; preservar CRUD necessário.
4. Introduzir helpers privados e contrato de mutação sem remover de imediato os caminhos existentes.
5. Instrumentar decisões em shadow mode e inventariar usuários legados.
6. Migrar frontend e Edge Functions para o contrato canônico.
7. Ativar enforcement e remover UPDATE sensível direto.
8. Remover fallback legado somente após relatório zerado ou exceções aprovadas.

**Rollback**: manter scripts explícitos para restaurar apenas as políticas canônicas anteriores e desabilitar o novo enforcement por configuração. Não restaurar execução anônima de funções privilegiadas, `TRUNCATE` ou política legada de exclusão. Em falha de automação, desativar a rota mutante nova e preservar leitura, sem liberar escrita direta ampla.

## Testing Strategy

- **Banco/RLS**: pgTAP valida conjunto exato de políticas, papéis, comandos, grants, execução de funções e resultados sob identidades simuladas.
- **Domínio**: Vitest cobre matriz de capacidades, campos sensíveis, transições, normalização de setor e respostas seguras.
- **Frontend**: Testing Library cobre presença/ausência de ações e reação a revogação/negação.
- **Edge Functions**: testes Deno cobrem JWT, organização, tarefa, ação, idempotência e falha fechada.
- **Integração**: cenários ponta a ponta por Kanban, Lista, Calendário, URL, WhatsApp, obrigações e Acessórias.
- **Performance**: seed de 10.000 tarefas, plano de consulta e p95 de leitura/mutação.
- **Regressão**: `npm run verify:deploy` mais advisors de segurança e desempenho.

## Project Structure

### Documentation (this feature)

```text
specs/012-review-task-permissions/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── task-capability-matrix.md
│   └── task-mutation-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── components/app/
│   └── KanbanTaskDetailSheet.tsx
├── hooks/
│   └── useAuth.tsx
├── lib/
│   ├── taskPermissions.ts              # nova representação compartilhada de capacidades para UI
│   ├── taskSectorAccess.ts             # compatibilidade temporária; reduzir após migração
│   └── changeHistory.ts                # leitura; gravação sensível migra para backend
├── pages/
│   ├── KanbanPage.tsx
│   ├── TarefasPage.tsx
│   ├── TaskWorkspacePage.tsx
│   └── CalendarioPage.tsx
└── test/
    └── taskPermissions.test.ts

supabase/
├── functions/
│   ├── _shared/
│   │   └── task-authorization.ts       # validação comum para funções privilegiadas
│   ├── task-actions/                   # endpoint canônico de mutação humana
│   ├── whatsapp-ticket-actions/
│   ├── grow-obligations-module/
│   └── acessorias-module/
├── migrations/
└── tests/
    ├── task_permissions_rls.sql
    ├── task_permissions_grants.sql
    └── task_permissions_mutations.sql
```

**Structure Decision**: preservar o monólito Vite/React e as Edge Functions existentes. Introduzir um único ponto backend de mutação humana e um helper compartilhado para integrações, sem criar novo serviço ou dependência. RLS permanece como defesa em profundidade e leitura; regras de ação sensível ficam no backend.

## Constitution Check — Post Design

- [x] Least privilege: políticas sobrepostas, grants globais e execução anônima são removidos.
- [x] Tenant isolation: toda decisão inclui organização; clientes não recebem acesso interno.
- [x] Backend ownership: mutações, automações e auditoria são centralizadas.
- [x] Scalability: leitura paginada/filtrada e índices orientados aos filtros principais.
- [x] Operability: shadow mode, auditoria, métricas, rollout e rollback definidos.

## Complexity Tracking

Nenhuma violação constitucional requer justificativa. O endpoint canônico adicional reduz, em vez de ampliar, a duplicação de regras sensíveis.
