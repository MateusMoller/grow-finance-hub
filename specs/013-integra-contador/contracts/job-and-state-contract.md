# Contract: Fiscal Jobs, Idempotency and States

## Standard job metadata

```ts
type FiscalJobMessage = {
  jobId: string;
  organizationId: string;
  clientId?: string;
  capabilityKey: string;
  correlationId: string;
};
```

Secrets, certificates, tokens, raw fiscal payloads and taxpayer identifiers are prohibited in queue messages.

## Sync state machine

```text
queued
  -> processing
     -> waiting_external -> processing
     -> completed
     -> requires_action
     -> failed
  -> cancelled
```

Allowed transitions:

| From | To | Condition |
|---|---|---|
| queued | processing | Worker atomically claims eligible message/job. |
| queued | cancelled | Connection/client/feature disabled before processing. |
| processing | waiting_external | Provider returns accepted/no-content with next check. |
| waiting_external | processing | Wait elapsed and message redelivered/requeued. |
| processing | completed | Normalized result persisted and usage/audit durable. |
| processing | requires_action | Authorization, certificate, data or human-review condition. |
| processing | failed | Retryable error exhausted or non-actionable definitive failure. |
| failed | queued | New linked run created by eligible retry/reprocess; original remains failed. |

Updates must include expected prior state to prevent stale workers overwriting terminal outcomes.

## Retry classification

| Category | Automatic action |
|---|---|
| Authentication/401 | Shared token invalidation, one refresh and one replay. |
| Validation/400 | No retry. |
| Authorization/403/procuration | `requires_action`; no automatic retry. |
| Not found/404 | Capability-specific terminal/no-result decision. |
| Rate limit/429 | Requeue after documented/reset window; count attempt. |
| Temporary 5xx/timeout/network | Exponential backoff + jitter, bounded attempts. |
| External waiting 202/204 | Schedule provider-directed next check; not counted as failure retry. |
| Malformed response | Fail closed; retry only if registry policy explicitly permits. |

## Request fingerprint

Canonical input:

```text
organizationId
clientId
capabilityKey
periodKey-or-empty
canonical-json(parameters)
```

Hash: SHA-256. Canonical JSON sorts keys and preserves numeric/text fiscal semantics. Fingerprints deduplicate equivalent reads; they are not exposed to users.

## Idempotency key

For future external effects:

```text
organizationId:clientId:operation:period:business-identity
```

The database unique constraint is authoritative. A completed operation returns the stored external reference/result. A processing or waiting operation returns its current state. Failed operations require an explicit policy before a new key/run.

## Queue acknowledgment

1. Worker receives message inside visibility window.
2. Load job and revalidate tenant/client/capability.
3. Transition queued/waiting to processing atomically.
4. Execute external request without holding a database transaction.
5. Persist normalized result, usage and terminal/waiting state.
6. Delete/archive queue message only after step 5 commits.
7. If worker crashes, message becomes visible; state/fingerprint prevents duplicate effect.

## Token refresh lease

Token refresh uses a short database lease, not a long lock:

- one worker claims `refresh_owner` and `refresh_locked_until` atomically;
- external authentication occurs outside a transaction;
- successful worker replaces encrypted tokens and clears lease;
- failed worker clears or lets lease expire;
- other workers wait bounded time and reread;
- a stale owner cannot overwrite a newer token without matching lease owner/version.

## Pilot completion transaction

For Caixa Postal indicator, one short database operation must:

- upsert `caixa_postal_indicators` by organization/client;
- upsert request cache/fingerprint;
- mark sync completed using expected state;
- record the corresponding business audit reference.

The external call and large payload processing occur before this transaction.
