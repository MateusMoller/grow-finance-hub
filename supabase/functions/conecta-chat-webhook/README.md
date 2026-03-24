# Conecta Chat -> Kanban webhook

This function receives task events from Conecta Chat and mirrors them into
`public.kanban_tasks`.

## Endpoint

`POST /functions/v1/conecta-chat-webhook`

This function is configured with `verify_jwt = false` in `supabase/config.toml`
because requests come from an external webhook source.

## Authentication

Send the same token configured in `Configuracoes -> Integracoes -> Token da API`
using one of these options:

- `Authorization: Bearer <TOKEN>`
- `x-api-token: <TOKEN>`
- `x-conecta-token: <TOKEN>`

## Supported payload formats

The function accepts multiple shapes, including:

```json
{
  "event": "task.created",
  "task": {
    "id": "123",
    "title": "Retornar cliente XPTO",
    "description": "Cliente pediu suporte fiscal",
    "priority": "high",
    "status": "open",
    "sector": "Fiscal",
    "assignee_name": "Ana",
    "client_name": "XPTO LTDA",
    "due_date": "2026-03-30",
    "tags": ["Fiscal", "Urgente"]
  }
}
```

## Behavior

- Creates/updates a `kanban_tasks` row using:
  - `integration_source = conecta_chat`
  - `integration_task_id = <task id from payload>`
- Uses upsert to avoid duplicates on webhook retries.
- Maps source status/priority/sector to values used by the Grow Kanban board.
