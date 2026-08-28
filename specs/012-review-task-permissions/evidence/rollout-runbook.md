# Runbook de rollout — permissões de tarefas

## Flags operacionais

As flags ficam em `organization_settings.operational_limits.task_permissions`:

- `shadow_mode`: compara decisões sem bloquear o caminho legado.
- `canonical_mutations`: direciona mutações humanas para `task-actions`.
- `enforce_canonical`: remove escrita sensível direta após migração dos consumidores.

Ausência ou valor inválido mantém enforcement novo desativado, sem restaurar grants anônimos ou DELETE legado.

## Sequência

1. Aplicar contenção e executar pgTAP.
2. Publicar `task-actions` sem mudar consumidores.
3. Ativar `shadow_mode` e observar divergências por organização.
4. Migrar Kanban, Lista, detalhe e integrações.
5. Ativar `canonical_mutations` por organização.
6. Confirmar ausência de escritor direto e ativar `enforce_canonical`.
7. Remover fallback legado após relatório zerado.

## Métricas

- negações por ação, origem e `reason_code`;
- conflitos de versão;
- divergências shadow canônico × legado;
- mutações sem auditoria correspondente;
- falhas de integração após decisão permitida;
- latência p50/p95 do endpoint.

## Rollback

Desativar `canonical_mutations` apenas enquanto a escrita RLS compatível existir. Nunca restaurar execução anônima, `TRUNCATE`, `TRIGGER`, `REFERENCES` ou DELETE de manager. Depois do enforcement, rollback deve restaurar a última policy canônica versionada.
