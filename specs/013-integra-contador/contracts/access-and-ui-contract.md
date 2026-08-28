# Contract: Access, Navigation and User Experience

## Capability model

| Capability | Admin | Authorized manager | Fiscal collaborator | Client portal |
|---|---:|---:|---:|---:|
| `fiscal.read` | yes | yes | scoped | no in MVP |
| `fiscal.sync` | yes | yes | scoped | no |
| `fiscal.reprocess` | yes | yes when granted | no by default | no |
| `fiscal.generate_guides` | future explicit | future explicit | no by default | no |
| `fiscal.transmit` | future explicit | future explicit | no by default | no |
| `integration.manage` | yes | optional explicit | no | no |
| `certificate.manage` | yes, never sees secret | no by default | no | no |
| `procuration.manage` | yes | optional explicit | read action status | no |

Backend decisions use canonical organization access and module grants. UI hiding is convenience, not authorization.

## Navigation

Internal route:

```text
/app/integracoes/integra-contador
```

Lazy loaded and guarded by internal scope plus `integra_contador` feature/capability. It contains:

- Overview: connection health, last success, action-required counts.
- Clients: paginated client authorization/sync status.
- Monitoring: paginated runs, failures and usage summaries.
- Settings: admin-only sanitized configuration and tests.

Settings includes a one-time secure form for environment, Consumer Key/Secret, P12/PFX and password. Secret fields are never prefilled, re-read, cached or displayed after submission. Only sanitized metadata (environment, certificate expiry/fingerprint, last validation and action required) is shown, and the prepared-material flow must be keyboard/screen-reader completable within five minutes.

## Existing operational surfaces

- Client detail gets an extracted “Situação fiscal” section/component; do not add more inline density to the existing large page.
- Tasks remain in the canonical task workspace.
- Obligation facts update existing obligation instances/events through backend contracts.
- Calendar receives only actual fiscal deadlines, never technical sync events.
- Finance receives normalized payment facts only in later scoped domains.
- Portal has no Integra Contador route in MVP.

## UX states

Every fiscal card/run shows one of:

- Updated — with source timestamp.
- Updating — with non-blocking progress.
- Waiting for Receita — with next check when available.
- Requires action — with concrete reason and next step.
- Temporarily unavailable — preserving last reliable timestamp.
- Disabled/not configured — with admin guidance.

Technical terms such as endpoint, action route, `idSistema`, `idServico`, JWT and HTTP status are excluded from normal user copy.

## Task creation rule

A task is created only if all are true:

1. There is concrete human work.
2. The organization/client and sector are resolved.
3. A stable integration key prevents duplicates.
4. The task contains client, reason, source, context, recommended action and deadline if known.
5. Creation uses the canonical task system-origin mutation contract.

Successful sync, cache hit and transient retry do not create tasks.

## Accessibility and responsiveness

- Status is conveyed by text/icon, never color alone.
- Action-required guidance is keyboard reachable and screen-reader labeled.
- Tables collapse to cards/priority columns on narrow screens; pagination remains server-driven.
- Focus returns to the initiating control or status region after manual sync.
- Background progress is announced politely and does not block navigation.

## Portal publication (future contract)

Only an explicit publication action can expose a fiscal document/message-derived item. It requires active `client_users` membership and published metadata. Raw provider payload, unrevised messages, technical logs, consumption and internal reviews are never portal-visible.
