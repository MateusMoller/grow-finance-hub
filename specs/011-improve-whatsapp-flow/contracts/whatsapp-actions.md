# Contract: WhatsApp Actions and Routing

This contract defines the internal action semantics used by the improved WhatsApp flow.

## Action Names

| Action | Client Label | Meaning |
|--------|--------------|---------|
| `menu` | Voltar ao menu | Clear temporary flow context and show the main menu |
| `attendance` | Falar com a equipe | Route conversation to human attendance |
| `requests` | Solicitacoes | Show request management menu |
| `consult_tasks` | Consultar tarefas | List open tasks for the linked client |
| `create_task` | Nova solicitacao | Start guided task creation |
| `end_flow` | Encerrar | End the automatic flow |

## Routing Rules

### Menu

**Input**:
- Button/list action `menu`
- Free text equivalent: `menu`, `inicio`, `iniciar`, `oi`, `ola`

**Outcome**:
- Clear active ticket context.
- Clear active task creation flow if needed.
- Show main menu.
- Conversation remains in automatic/open state.

### Attendance

**Input**:
- Button/list action `attendance`
- Free text equivalent: `atendimento`, `falar com atendente`, `falar com a equipe`, `humano`

**Outcome**:
- Conversation status becomes attendance queue state.
- Assigned team becomes `Atendimento`.
- Internal notification is created.
- Client receives office-hours-aware response.
- Human attendance is considered available Monday to Friday until 17:00 local Sao Paulo time.
- Outside office hours, the conversation remains queued internally after the after-hours response.

### Requests

**Input**:
- Button/list action `requests`
- Free text equivalent: `solicitacoes`, `solicitacao`, `demandas`

**Outcome**:
- Show request submenu.
- Conversation remains in automatic/open state.

### Consult Tasks

**Input**:
- Button/list action `consult_tasks`
- Free text equivalent: `consultar tarefas`, `tarefas abertas`, `tarefas em andamento`

**Outcome**:
- If linked client exists, list bounded open tasks for that client.
- If no linked client exists, explain that a client link is required.
- Send final actions.
- Completed and archived tasks are excluded.

### Create Task

**Input**:
- Button/list action `create_task`
- Free text equivalent: `nova tarefa`, `criar nova tarefa`, `abrir tarefa`
- Active request type selection

**Outcome**:
- Start or continue guided task creation.
- Create internal task and customer ticket only after required answers are collected.
- Send ticket confirmation and final actions.
- If no reliable linked client exists, do not create a task; ask for client identification or route to human attendance.

### End Flow

**Input**:
- Button/list action `end_flow`
- Free text equivalent: `encerrar`, `encerrar atendimento`, `finalizar`, `sair`

**Outcome**:
- Clear active automatic contexts.
- Confirm automatic flow ending.
- Do not reopen menu unless the client asks again.

## Idempotency Requirements

- Daily greeting idempotency key must include organization, conversation, and local date.
- Menu sends derived from a single inbound message must not duplicate for the same message.
- Task creation from a flow must create at most one task and one customer ticket.
- Delivery failures must not trigger repeated duplicate client-facing messages.
- Delivery failures must stop the next automatic flow step until internal intervention or explicit retry.

## Audit Requirements

Record events for:
- Daily greeting sent or skipped.
- Main menu sent.
- Request menu sent.
- Client selected action.
- Human attendance requested.
- After-hours attendance response sent.
- Task consultation requested.
- Task creation started, cancelled, expired, and completed.
- Ticket context activated.
- Automatic flow ended.
- WhatsApp provider delivery failure.

## Delivery Failure Semantics

When the WhatsApp provider returns a failed delivery for an automatic flow message:

- Store the provider error and mark the affected outbound message as failed.
- Mark the active flow or conversation as blocked for automatic progression.
- Show a visible internal alert in the WhatsApp module.
- Do not enqueue the next menu, task consultation response, ticket confirmation, or final action as if the failed message was delivered.
- Allow a future internal action or explicitly valid retry path to resume the flow.
