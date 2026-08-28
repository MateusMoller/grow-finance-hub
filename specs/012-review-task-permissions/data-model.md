# Data Model: Permissões canônicas de tarefas

## Existing Entities

### OrganizationUserAccess

Fonte canônica de identidade operacional dentro de uma organização.

| Field | Rule |
|---|---|
| organization_id | Obrigatório; limite de tenant |
| user_id | Obrigatório; único por organização |
| primary_role | `admin`, `colaborador` ou `cliente` |
| status | Apenas `active` autoriza operações |
| sector_code | Obrigatório para colaborador operacional |
| requires_access_review | Quando verdadeiro, nega por padrão |

### UserModuleGrant

Concessão explícita de módulo para colaborador. `tarefas` é obrigatório para capacidades operacionais do módulo.

### KanbanTask

| Field group | Fields | Authorization impact |
|---|---|---|
| Tenant | organization_id | Imutável por usuários finais |
| Scope | sector, client_name, assigned_to_user_id | Mudança exige capacidade específica |
| Content | title, description, tags, subtasks, priority, due_date | Editável conforme capacidade operacional |
| Workflow | status, deleted_at, deleted_by, version | Transição validada; arquivo/exclusão lógica são administrativos e toda mutação usa versão otimista |
| Integration | integration_source, integration_task_id, integration_payload, request_id | Imutável por edição comum |
| Audit | created_by, created_at, updated_at | Controlado pelo sistema |

### KanbanTaskComment

Herda organização e acesso da tarefa. `user_id` deve ser o autor autenticado. Atualização somente pelo autor ainda autorizado; exclusão administrativa.

### KanbanTaskRelation

Relaciona duas tarefas da mesma organização. Criação exige acesso/capacidade nos dois lados. O banco deve garantir que `organization_id` corresponda às duas tarefas, não apenas confiar no payload.

### OperationalAuditLog

Registro append-only para tarefa.

Campos mínimos: organization_id, entity_type=`task`, entity_id, action, result, actor_user_id, actor_kind, actor_source, correlation_id, metadata.before, metadata.after, metadata.changed_fields, created_at.

## New Logical Entity: TaskCapabilityDecision

Entidade derivada, não necessariamente persistida.

| Field | Description |
|---|---|
| organization_id | Tenant avaliado |
| user_id | Ator humano, se houver |
| task_id | Recurso existente, quando aplicável |
| action | Capacidade solicitada |
| allowed | Resultado booleano |
| reason_code | Código seguro e estável |
| sector_code | Setor canônico considerado |
| actor_kind | `human` ou `system` |
| evaluated_at | Momento da decisão |

## Capability Set

- `task.read`
- `task.create`
- `task.update_content`
- `task.change_status`
- `task.assign`
- `task.change_sector`
- `task.change_client`
- `task.manage_subtasks`
- `task.comment`
- `task.relate`
- `task.archive`
- `task.delete`

## State Transitions

```text
backlog -> todo -> doing -> review -> done -> archived
   ^        |       |        |        |
   └────────┴───────┴────────┴────────┘  (reabertura conforme capacidade)
```

- Colaborador autorizado pode executar transições operacionais permitidas.
- `archived` e DELETE exigem administrador.
- Tarefas de obrigação devem preservar sincronização com a instância antes do commit.
- Transição inválida ou falha na integração cancela a mutação e registra falha controlada.

## Validation Rules

1. `organization_id` não muda após criação.
2. Setor desconhecido/ausente é negado para colaborador.
3. Cliente não obtém acesso por conhecer task_id.
4. `integration_*` não é editável por mutação humana genérica.
5. Atribuição exige responsável elegível na mesma organização e, quando aplicável, no setor de destino.
6. Relações são simétricas, sem auto-relação e dentro do mesmo tenant.
7. Operações em lote aceitam no máximo 100 tarefas, validam todos os itens antes da primeira escrita e são integralmente revertidas se qualquer item for negado, inválido ou estiver com versão desatualizada.
8. Idempotency key de automação é única por organização, origem e operação lógica.
9. Exclusão comum preenche `deleted_at` e `deleted_by`; registros excluídos ficam fora das consultas operacionais e podem ser restaurados somente por administrador durante 1 ano.
10. O expurgo físico após 1 ano é uma rotina administrativa separada e auditada.

## Index Review

Preservar/revisar índices para:

- `(organization_id, status, sector)`
- `(organization_id, assigned_to_user_id, status)`
- `(organization_id, due_date, status)`
- `(organization_id, client_name, status)`
- `(organization_id, integration_source, integration_task_id)`
- auditoria `(organization_id, entity_type, entity_id, created_at desc)`

Adicionar somente após `EXPLAIN` comprovar lacuna; evitar índices redundantes.
