# Tenant-ready foundation

Esta entrega inicia a escalabilidade do Grow Finance Hub sem remover a identidade Grow.

## Implementado

- Criacao da organizacao inicial `grow` em `organizations`.
- Configuracoes operacionais por organizacao em `organization_settings`.
- `organization_id` nas principais tabelas operacionais, com backfill dos dados atuais para a Grow.
- Evolucao de `user_roles` para escopo por organizacao.
- Novo vinculo `client_users` para permitir mais de um usuario por cliente futuramente.
- Trigger de compatibilidade para sincronizar `clients.portal_user_id` com `client_users`.
- Funcoes SQL centrais:
  - `default_organization_id()`
  - `current_organization_id()`
  - `has_org_role(user_id, organization_id, role)`
  - `is_internal_user(user_id, organization_id)`
  - `can_access_client(user_id, client_id)`
- `has_role(user_id, role)` e `is_internal_user(user_id)` foram mantidas como compatibilidade, delegando para a organizacao ativa.
- Tabela `operational_audit_logs` para trilha de auditoria.
- `useAuth` agora expoe organizacoes, organizacao ativa e papeis filtrados por organizacao.
- Portal, IA e Open Finance passam a aceitar o novo modelo `client_users` mantendo fallback para `portal_user_id`.
- Migration `20260515123000_tenant_rls_critical_modules.sql` com RLS tenant-aware inicial para clientes, portal, tarefas, calendario, obrigacoes, financeiro/Open Finance, IA, WhatsApp e credenciais de integracao.
- Edge Functions criticas atualizadas para resolver organizacao antes de gravar `user_roles`, clientes, newsletters, push e tokens de integracao.

## Ainda pendente

- Validar e aplicar as migrations tenant-ready no Supabase remoto/staging antes de producao.
- Migrar CRM/metas/leads de `localStorage` para Supabase.
- Criar painel de saude operacional.
- Trocar constantes operacionais por `organization_settings`.
- Regenerar tipos Supabase coluna a coluna quando o CLI autenticado estiver disponivel.
- Rodar `build` e `test` em Node 20.19+.

## Checklist de rollout

1. Criar backup do banco de producao antes de aplicar qualquer migration.
2. Aplicar primeiro `20260515120000_add_tenant_ready_foundation.sql` em staging.
3. Confirmar que a organizacao `grow` foi criada e que todos os registros operacionais receberam `organization_id`.
4. Confirmar que `user_roles` possui indice unico em `user_id, organization_id, role` e nao depende mais de `user_id, role`.
5. Confirmar que `clients.portal_user_id` populou `client_users` com `status = 'active'`.
6. Aplicar `20260515123000_tenant_rls_critical_modules.sql` em staging.
7. Testar login interno, login portal, cadastro/edicao de cliente, vinculo de portal, tarefas, calendario, obrigacoes, financeiro/Open Finance, IA, WhatsApp e relatorios.
8. Rodar `npm run lint`, `npm run test`, `npm run build` e `npm run verify:deploy` em Node 20.19+.
9. Aplicar em producao somente depois de staging passar nos cenarios criticos.
10. Pos-producao: auditar registros sem `organization_id`, erros em Edge Functions e usuarios de portal sem vinculo em `client_users`.

## Rollback manual

- Se a migration de RLS bloquear acesso indevidamente, restaurar temporariamente as policies anteriores pelo backup ou pausar o rollout antes de producao.
- Se a fundacao tenant-ready falhar em staging, nao aplicar em producao; corrigir os conflitos de tabela/constraint e reexecutar em um banco restaurado.
- Se houver falha apos producao, preferir restaurar backup completo quando a falha envolver constraints ou backfill. Para erro apenas de policy, aplicar uma migration corretiva de RLS preservando os dados ja migrados.

## Observacao

A migration define a Grow como organizacao padrao para preservar os fluxos atuais. Isso permite que os modulos sejam migrados gradualmente para envio explicito de `organization_id`, sem quebrar inserts existentes durante a transicao.
