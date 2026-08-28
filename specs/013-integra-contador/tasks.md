# Tasks: DCTFWeb assistida dentro das tarefas

## Phase 1 — Setup

- [X] T001 Validar contrato Trial DCTFWeb em `tests/unit/integraContador/dctfwebContract.test.ts`
- [X] T002 [P] Criar tipos de domínio em `supabase/functions/_shared/integra-contador/domains/dctfweb/contracts.ts`
- [X] T003 [P] Criar checklist versionado em `docs/integrations/integra-contador/domains/dctfweb.md`

## Phase 2 — Foundational

- [X] T004 Criar migration pelo Supabase CLI para dossiês, operações, artefatos, RLS e RPCs DCTFWeb em `supabase/migrations/`
- [X] T005 Implementar adapter Trial e envelopes dos seis serviços em `supabase/functions/_shared/integra-contador/domains/dctfweb/client.ts`
- [X] T006 [P] Adicionar testes Deno do adapter em `supabase/functions/_shared/integra-contador/domains/dctfweb/client_test.ts`
- [X] T007 Implementar ações autenticadas e tenant-scoped em `supabase/functions/integra-contador-module/index.ts`

## Phase 3 — User Story 6: consultar DCTFWeb na tarefa

**Independent test**: tarefa DCTFWeb prepara um único dossiê e consulta XML, recibo e relatório sem alterar outras tarefas.

- [X] T008 [US6] Adicionar contratos frontend DCTFWeb em `src/features/integra-contador/types.ts`
- [X] T009 [US6] Adicionar chamadas tipadas em `src/features/integra-contador/api.ts`
- [X] T010 [US6] Criar hook TanStack Query em `src/features/integra-contador/hooks/useTaskDctfwebDossier.ts`
- [X] T011 [US6] Criar painel contextual em `src/features/integra-contador/components/TaskDctfwebPanel.tsx`
- [X] T012 [US6] Integrar painel sem alterar outros tipos em `src/components/app/KanbanTaskDetailSheet.tsx`

## Phase 4 — User Story 6: emitir DARF assistido

**Independent test**: emissão confirmada produz um único artefato privado para a competência e modo escolhidos.

- [X] T013 [US6] Implementar confirmação e seleção transmitida/em andamento em `src/features/integra-contador/components/TaskDctfwebPanel.tsx`
- [X] T014 [US6] Implementar idempotência e persistência de DARF em `supabase/functions/integra-contador-module/index.ts`
- [X] T015 [US6] Vincular artefatos à obrigação pela migration DCTFWeb em `supabase/migrations/`

## Phase 5 — User Story 6: transmissão controlada

**Independent test**: transmissão permanece bloqueada sem todos os gates e timeout entra em estado desconhecido sem retry cego.

- [X] T016 [US6] Implementar upload/hash e aprovação de XML em `supabase/functions/integra-contador-module/index.ts`
- [X] T017 [US6] Implementar gates de transmissão e estado ambíguo na migration DCTFWeb em `supabase/migrations/`
- [X] T018 [US6] Adicionar confirmação produtiva no painel em `src/features/integra-contador/components/TaskDctfwebPanel.tsx`

## Phase 6 — Polish and validation

- [X] T019 Adicionar regressão do fluxo da tarefa em `src/test/taskDctfwebWorkflow.test.ts`
- [X] T020 [P] Adicionar contrato de segurança/RLS em `supabase/tests/dctfweb_task_workflow.sql`
- [X] T021 Atualizar tipos Supabase em `src/integrations/supabase/types.ts`
- [X] T022 Executar `npm run verify:deploy` e registrar limitações de Deno/Supabase local

## Dependencies

`T001-T003 -> T004-T007 -> T008-T012 -> T013-T015 -> T016-T018 -> T019-T022`

## Scope guards

- Nenhuma emissão em lote ou transmissão autônoma.
- Nenhuma chamada SERPRO no browser.
- Nenhum XML, certificado, token ou payload fiscal bruto em logs.
- PGDAS-D, DEFIS e tarefas genéricas devem permanecer inalterados.
