# Contract: Internal Fiscal API

## General rules

- Internal authenticated application only for MVP.
- Every request validates user JWT, active organization, capability, client membership in that organization and input.
- Responses contain business vocabulary, safe error codes and a correlation ID.
- No generic `/serpro/call` action exists.
- Long-running work returns `202`-style queued state and a `syncRunId`; it does not hold the browser request open.

## `connection_status`

**Purpose**: Read sanitized connection/health status.

Request:

```json
{
  "action": "connection_status",
  "organizationId": "uuid"
}
```

Response:

```json
{
  "ok": true,
  "correlationId": "uuid",
  "connection": {
    "status": "active",
    "environment": "validation",
    "certificateExpiresAt": "2027-01-01T00:00:00Z",
    "enabledCapabilities": ["caixa_postal.new_message_indicator"],
    "lastHealthCheckAt": "2026-08-14T12:00:00Z",
    "lastSuccessAt": "2026-08-14T12:00:00Z",
    "actionRequired": null
  }
}
```

Never returns secret references or values.

## `test_connection`

Admin/integration-manager only. Creates an audited validation attempt. It must not echo certificate/credential details.

## `configure_connection`

Admin/integration-manager only. Accepts prepared Consumer Key/Secret, P12/PFX, password and environment once over TLS using a size-limited multipart request. The backend revalidates JWT/organization/capabilities, validates environment and file, transfers secrets to Vault, persists only references plus sanitized certificate metadata, discards buffers and audits without secret values.

The response contains only `correlationId`, sanitized connection status and action required. Reads cannot recover submitted secrets. The five-minute usability clock starts when Settings opens for an administrator already holding valid materials and ends when configuration/test displays operational or action-required status.

## `sync_client`

Request:

```json
{
  "action": "sync_client",
  "organizationId": "uuid",
  "clientId": "uuid",
  "capability": "caixa_postal.new_message_indicator",
  "forceRefresh": false
}
```

Accepted response:

```json
{
  "ok": true,
  "correlationId": "uuid",
  "syncRunId": "uuid",
  "status": "queued",
  "cacheHit": false
}
```

Cached response may return `status: completed`, `cacheHit: true`, current normalized result and its validity timestamp without queueing an external call.

## `get_client_fiscal_status`

Returns only normalized fiscal state, authorization summary, last synchronization and allowed actions for one authorized client. Pilot includes Caixa Postal indicator only.

## `list_sync_runs`

Uses server filters and keyset cursor:

```json
{
  "action": "list_sync_runs",
  "organizationId": "uuid",
  "filters": {
    "clientId": "uuid-or-null",
    "capability": "string-or-null",
    "status": ["failed", "requires_action"]
  },
  "cursor": {
    "createdAt": "timestamp",
    "id": "uuid"
  },
  "limit": 50
}
```

Maximum limit: 100.

## `reprocess_sync`

Admin/manager with `fiscal.reprocess`. Only eligible failed runs can create a new run with reason `admin_reprocess`. The original run remains immutable and linked.

## Error response

```json
{
  "ok": false,
  "code": "procuration_required",
  "message": "A procuração necessária para esta consulta não foi identificada.",
  "actionRequired": "Regularize a procuração do cliente e teste novamente.",
  "correlationId": "uuid"
}
```

Stable codes include:

- `unauthorized`
- `forbidden`
- `invalid_request`
- `organization_not_available`
- `client_not_available`
- `feature_disabled`
- `connection_not_ready`
- `procuration_required`
- `certificate_invalid`
- `external_contract_unverified`
- `sync_already_active`
- `rate_limited`
- `provider_unavailable`
- `reprocess_not_allowed`
- `operation_failed`

## UI query keys

Remote state is scoped at minimum by:

```text
["integra-contador", organizationId, "connection"]
["integra-contador", organizationId, clientId, "fiscal-status"]
["integra-contador", organizationId, "sync-runs", filters, cursor]
```

Polling occurs only for visible queued/processing/waiting runs and stops on a terminal state.
