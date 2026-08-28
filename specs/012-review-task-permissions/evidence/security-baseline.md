# Baseline de segurança — permissões de tarefas

Data: 2026-08-12

## Evidências confirmadas

- `can_access_task_values` ainda continha fallback para `user_roles` quando não existia `organization_user_access`.
- `can_access_task_sector` é `SECURITY DEFINER` e estava executável por `authenticated`.
- A cadeia histórica contém a policy `Authenticated can delete own tasks`, que incluía o papel legado `manager`.
- A policy canônica de UPDATE concede alteração da linha inteira a quem possui acesso operacional à tarefa.
- `whatsapp-ticket-actions` validava o módulo WhatsApp e atualizava a tarefa com service role sem validar capacidade na tarefa específica.
- Obrigações, Acessórias, WhatsApp e webhook possuem escritores diretos de `kanban_tasks`.
- `recordTaskHistoryEntry` grava auditoria após a mutação e trata falha apenas com `console.warn`.

## Inventário de superfícies

| Superfície | Caminho | Risco inicial |
|---|---|---|
| RLS e helpers | `supabase/migrations/20260625130753_user_permissions_task_rls.sql` | fallback legado e UPDATE amplo |
| Exclusão histórica | `supabase/migrations/20260320110714_b88dd27b-ed7a-45e0-ba30-b8f72d428fe8.sql` | concessão a manager |
| WhatsApp delegado | `supabase/functions/whatsapp-ticket-actions/index.ts` | service role sem escopo da tarefa |
| WhatsApp mensagens | `supabase/functions/whatsapp-send-message/index.ts` | escritor privilegiado |
| Obrigações | `supabase/functions/grow-obligations-module/index.ts` | escritor privilegiado |
| Acessórias | `supabase/functions/acessorias-module/index.ts` | escritor privilegiado |
| Frontend | `src/pages/KanbanPage.tsx`, `src/pages/TarefasPage.tsx` | mutações diretas e decisão duplicada |
| Auditoria | `src/lib/changeHistory.ts` | sucesso não atômico |

## Contenção esperada

1. Remover policies DELETE legadas e privilégios globais.
2. Impedir sondagem de identidade arbitrária nos helpers expostos.
3. Remover fallback legado da decisão de tarefas.
4. Introduzir versão, exclusão lógica e mutação service-role-only.
5. Migrar consumidores antes de remover UPDATE/INSERT direto.
