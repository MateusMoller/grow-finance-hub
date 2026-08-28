# Integra Contador rollout and operations

## Safety invariant

The real provider is disabled unless every item in the contract gate in `specs/013-integra-contador/research.md` has dated evidence. Frontend code never receives credentials, certificate material or provider tokens. The initial capability is read-only: `caixa_postal.new_message_indicator`.

## Environment progression

1. **Fake** — default for local, CI and demonstrations. Validate authorization, idempotency, retries, retention, UI and audit without external traffic.
2. **Validation** — isolated contracted test credentials and certificate, one organization and a small client allowlist after health and mTLS tests pass.
3. **Production** — separate Vault references and certificate, feature disabled by default, then admin health, pilot cohort and gradual expansion.

## Flags, kill switch and rollback

Organization feature and capability flags control navigation and actions independently. The provider kill switch fails closed: stop enqueue/provider execution while preserving stale, visibly dated read models and history. Never invoke an adapter around the switch.

Rollback order: activate the kill switch; disable the organization capability; stop monitor/worker schedules; preserve queue/audit evidence; revert application code; revert schema only through an explicit forward-safe migration. Existing obligations, tasks, calendar and portal flows stay operational.

## mTLS fallback and certificate rotation

If Supabase Edge Runtime cannot complete contracted P12/PFX mTLS, route outbound calls through an approved dedicated backend/proxy with equivalent secret isolation, allowlisting, audit and timeouts. Never weaken TLS or export the certificate to browser/database.

Install a new versioned secret, validate it in validation, switch the connection reference atomically, run health plus one allowlisted read, then retire the old version. Alert 60/30/15/7 days before expiry; restore the prior reference if validation fails.

## Incident response

1. Classify credential exposure, authorization failure, provider outage, billing spike or queue backlog.
2. Stop provider traffic and the affected cohort; rotate secrets immediately for suspected exposure.
3. Record correlation IDs, safe error codes, organizations/capabilities and time window—never raw payloads or secrets.
4. Reauthenticate once on 401; require human action on 403; use bounded backoff on 429/5xx. Never retry blindly.
5. Reconcile incomplete jobs and normalized state before controlled re-enable; document root cause and prevention.

## Release and daily checks

Before rollout run lint, tests, build, deployment checks, migrations/RLS tests and the 5,000-client workload. Daily review connection health, terminal/action-required ratio, oldest queue age, cache ratio, request volume, estimated cost, certificate expiry and retention result. Reprocessing is admin-only and creates a child run.
