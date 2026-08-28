# Research: Integra Contador — Fundação e Sincronização Fiscal Inicial

**Date**: 2026-08-14  
**Context**: `SPEC_CONTEXT=INTEGRACAO_INTEGRA_CONTADOR`  
**Plan type**: `ARCHITECTURE_AND_IMPLEMENTATION`

## Decision 1: Preserve the Supabase monolith and create a modular integration boundary

**Decision**: Keep the existing Vite/React application, PostgreSQL/Supabase database, Storage, Auth and Edge Functions. Add a dedicated Integra Contador module under `supabase/functions/_shared/integra-contador/`, with thin entry-point Edge Functions and domain-specific adapters.

**Rationale**: The repository already owns authorization, tenant isolation, storage, auditing and integrations in Supabase. The modular Open Finance shared-adapter pattern is a better precedent than the large `acessorias-module/index.ts`. A new backend service would duplicate deployment, secrets, database access and observability before a proven runtime constraint requires it.

**Alternatives considered**:

- New standalone Node service: rejected for MVP because it duplicates infrastructure and operating surface.
- Add all logic to one Edge Function: rejected because the existing Acessorias module demonstrates the maintenance cost of a multi-thousand-line dispatcher.
- Call SERPRO from React: rejected because certificates, secrets, service-role operations and fiscal rules must remain backend-only.

## Decision 2: Use a provider interface with real and fake implementations

**Decision**: All fiscal domains depend on `IntegraContadorProvider`. Implement `SerproIntegraContadorProvider` for the contracted environment and `FakeIntegraContadorProvider` for local development and automated tests.

**Rationale**: This isolates transport, authentication, envelope serialization and external codes, permits deterministic tests without production consumption and prepares a real boundary for a future alternate fiscal provider without creating abstractions beyond the existing provider boundary.

**Alternatives considered**:

- Mock global `fetch`: rejected because it couples tests to transport details and does not test domain/provider boundaries.
- Use live production API in tests: prohibited by the specification and unsafe for cost and external effects.

## Decision 3: Pilot Caixa Postal with “new messages indicator” only

**Decision**: The first real vertical slice is the read-only Caixa Postal operation that obtains the indicator of new messages for a contributor. List and message detail remain behind later feature flags.

**Rationale**: It provides visible fiscal value while avoiding declaration transmission, document issuance and financial reconciliation. It exercises authentication, authorization, taxpayer envelope, external service registry, provider mapping, persistent state, audit, usage, cache, queue and UI status. It also aligns naturally with event-driven monitoring.

**Alternatives considered**:

- Payments: postponed because it introduces more sensitive financial data and reconciliation decisions.
- DCTFWeb: postponed because the domain combines asynchronous states, reports/XML, transmission and collection documents.
- Full Caixa Postal content: postponed until retention, classification and human-review rules are validated.

**EXTERNAL_CONTRACT_PENDING**: Confirm the contracted Caixa Postal capability, current `idSistema`, `idServico`, `versaoSistema`, applicable e-CAC procurement code and demonstration fixture before implementation.

## Decision 4: Centralize OAuth2 and mutual TLS authentication

**Decision**: `SerproAuthManager` owns OAuth2 client-credentials authentication, uses `CertificateProvider`, stores shared temporary tokens through `TokenStore`, refreshes before `expires_in`, and performs at most one forced refresh after a 401.

**Rationale**: SERPRO requires Consumer Key/Secret, the contracting e-CNPJ and returns both `access_token` and `jwt_token`. A shared store avoids authenticating for every call. An atomic refresh lease avoids token stampede across concurrent workers without holding a database transaction open during the external request.

**Alternatives considered**:

- In-memory token only: rejected because Edge Function instances do not share memory and may be recycled.
- Authenticate on every call: rejected due to latency, load and cost/limit risk.
- Hold a database advisory lock during the HTTP authentication request: rejected because long database transactions around external I/O create contention and failure risk.

**EXTERNAL_CONTRACT_PENDING**: Validate the documented `jwt_token` request header against references to `x-jwt-assertion` in manager error messages using the contracted Swagger/environment.

## Decision 5: Store long-lived secrets in Supabase Vault and temporary tokens encrypted in a private table

**Decision**: Consumer Key, Consumer Secret, certificate chain/private key and certificate password are stored as Supabase Vault secrets referenced by the tenant connection. Access occurs only through a narrowly granted private backend function. Temporary access/JWT tokens are encrypted before persistence in `private.integra_contador_token_cache`; only service-role backend paths can claim, read or replace them.

**Rationale**: The repository already enables Supabase Vault for scheduled backend calls. Long-lived secrets do not belong in public tables or frontend environment variables. Temporary tokens change frequently and need atomic refresh metadata, making a private encrypted cache table more suitable than repeatedly rewriting Vault secrets.

**Alternatives considered**:

- Store plaintext credentials in `integration_api_credentials`: rejected; that existing table stores hashes of Grow-issued user API tokens and has a different purpose.
- Store a P12 file in a user-accessible Storage bucket: rejected due to disclosure and policy complexity.
- Environment variables only: acceptable for a single proof environment but rejected as the target multi-organization model.

**EXTERNAL_CONTRACT_PENDING**: Confirm Edge Runtime support for the selected PEM client-certificate transport after secure conversion from contracted A1 P12/PFX. If mTLS cannot be established in the deployed Edge Runtime, the provider implementation moves behind a narrowly scoped secure fiscal worker/proxy; domain contracts and persistence remain unchanged.

## Decision 6: Use Supabase Queues (PGMQ) with persistent job metadata

**Decision**: Enable the logged Postgres-native PGMQ extension and create minimal queues `fiscal-sync` and `fiscal-monitor`. Keep `fiscal_jobs` as tenant-aware metadata/status visible to authorized users. Do not expose `pgmq_public` to frontend roles. `pg_cron` and `pg_net`, already used in the repository, invoke a protected worker Edge Function that reads messages with a visibility timeout and deletes/archives them only after durable completion.

**Rationale**: Supabase Queues provides durable delivery and visibility semantics without adding Redis or another deployment. A separate business job row provides stable progress, audit, retry state and UI correlation independent of queue internals.

**Alternatives considered**:

- Custom job table with `FOR UPDATE SKIP LOCKED`: viable fallback but duplicates queue visibility and archival behavior now available natively.
- External broker/Redis: rejected for MVP because it creates parallel infrastructure.
- Edge Function-to-Edge Function recursive chains: rejected due to operational complexity and current nested-call rate limits.

## Decision 7: Schedule workers and reconciliation with existing pg_cron + pg_net

**Decision**: Follow the existing WhatsApp timeout pattern: a private/revoked database function reads an internal invocation secret from Vault and uses `pg_net` to trigger the worker and monitor functions. Cron schedules are created, replaced and rolled back by migration.

**Rationale**: This is an established repository pattern and the official Supabase pattern for scheduled Edge Functions. It avoids a new scheduler.

**Alternatives considered**:

- Browser polling to drive processing: rejected because jobs must continue without an active user.
- Long-running Edge Function loop: rejected because function runtime is not a durable worker host.

## Decision 8: Use backend idempotency plus queue delivery semantics

**Decision**: PGMQ delivery is not treated as business exactly-once. `fiscal_operations` and unique request fingerprints enforce idempotency independently of queue retries. External HTTP calls occur outside long database transactions; results are committed with conditional state transitions and unique constraints.

**Rationale**: Network timeout can occur after SERPRO accepts an operation. Queue delivery guarantees alone cannot prove whether an external side effect happened. The first read-only pilot still establishes the mechanism for future mutating domains.

**Alternatives considered**:

- Frontend click suppression: rejected because it does not cover retries or concurrent workers.
- Queue message ID as the only key: rejected because the same logical request can arrive in different messages.

## Decision 9: Adopt per-capability cache policies and request fingerprints

**Decision**: `RequestFingerprint` is a SHA-256 hash over organization, client, capability, period and canonical parameters. The service registry defines `STATIC`, `SEMI_STATIC`, `TRANSACTIONAL` or `REAL_TIME` cache behavior. The Caixa Postal indicator starts with a short configurable validity window; a user “refresh now”, monitoring signal or reconciliation can bypass it with an audited reason.

**Rationale**: Cache validity depends on fiscal semantics. A universal TTL either wastes calls or serves stale data. Canonical hashing prevents duplicated equivalent requests.

**Alternatives considered**:

- No cache: rejected due to billeting and rate-limit concerns.
- Redis: rejected because persistent Postgres state is sufficient for the initial volume and already available.

## Decision 10: Keep audit, technical logs and usage as separate records

**Decision**: Reuse `operational_audit_logs` for user/system business actions, introduce `serpro_api_usage` for one row per external attempt and use sanitized structured console logs for technical runtime diagnostics. Raw payload persistence is opt-in per capability and stored separately with retention controls.

**Rationale**: Audit answers who/what/why, usage answers call/cost/latency, and runtime logs answer debugging. Mixing them either leaks fiscal data or makes investigations incomplete.

**Alternatives considered**:

- Put response payloads in audit metadata: rejected due to sensitivity and unbounded growth.
- Console logs only: rejected because they do not provide durable business trace or cost reconciliation.

## Decision 11: Generate opaque X-Request-Tag and full internal correlation IDs

**Decision**: Generate a free-text `X-Request-Tag` centrally, no longer than 32 characters, using an opaque prefix/hash/sequence. Store its mapping to the full UUID correlation ID, organization, client, job, workflow, capability and period.

**Rationale**: SERPRO includes the tag in detailed consumption reports but does not provide idempotency or validation guarantees. Opaque tags reduce fiscal identifier exposure while retaining reconciliation.

**Alternatives considered**:

- Put raw CPF/CNPJ in the tag: not selected because the free-text report does not require exposing identifiers.
- Use X-Request-Tag as idempotency: rejected; the external contract only defines it as an optional identifier.

## Decision 12: Map external responses to explicit internal states

**Decision**: Normalize external outcomes to `queued`, `processing`, `waiting_external`, `completed`, `failed`, `requires_action`, `cancelled`. Map 202 and 204 to `waiting_external` with the provider-supplied wait instruction; 400/403 and certificate/procuration problems to non-retryable or `requires_action`; 429 and eligible 5xx/timeouts to bounded rescheduling; 401 to one token refresh and one replay.

**Rationale**: SERPRO documents asynchronous 202/204 behavior and business/authorization errors. Explicit states support resumption and user guidance without boolean ambiguity.

**Alternatives considered**:

- Treat every non-200 as failure: rejected because 202/204 represent accepted processing.
- Retry all errors: prohibited and unsafe.

## Decision 13: Extend current canonical modules instead of duplicating them

**Decision**: Reuse `clients`, `obligation_instances`, `obligation_instance_events`, `obligation_instance_files`, `kanban_tasks`, `calendar_events`, `operational_audit_logs`, canonical task actions and the existing private `obligation-files` bucket where the file is truly an obligation artifact. Add dedicated integration/sync/event/usage/procuration entities; do not create parallel companies, generic obligations or audit logs.

**Rationale**: These existing tables own tenant, client and operational business rules. The Integra Contador layer produces facts and exceptions; existing modules decide how those facts affect work.

**Alternatives considered**:

- New `companies` and `fiscal_obligations`: rejected as conceptual duplication of `clients` and obligation entities.
- Write directly to task rows from adapters: rejected; integrations must use the canonical task mutation contract/system origin.

## Decision 14: Keep portal publication out of the pilot

**Decision**: The pilot is internal-only. Future portal visibility uses explicit publication fields/projections and client membership checks; synchronized messages are never automatically published.

**Rationale**: Caixa Postal content can be sensitive and require interpretation. Internal validation must precede client exposure.

**Alternatives considered**:

- Show all synchronized fiscal content immediately: rejected for confidentiality and UX risk.

## Decision 15: Roll out by tenant and capability flags

**Decision**: Add `integra_contador`, `integra_contador_monitor`, and capability flags such as `integra_contador_caixa_postal_indicator`. Start with fake provider, then demonstration/validation environment, internal tenant, small client cohort and broader rollout.

**Rationale**: External contracts, mTLS and procurement state vary. Independent kill switches reduce blast radius without disabling existing modules.

**Alternatives considered**:

- One global enable flag: rejected because it cannot isolate a failing capability or tenant.

## Decision 16: Make clarified acceptance metrics operational

**Decision**: Measure eligible sync duration from `fiscal_sync_runs.created_at` to a terminal or `requires_action` state, targeting 95% within 15 minutes. Measure client fiscal-read p95 against the 5,000-client reference dataset and cache efficiency as `cache_hits / cache_eligible_reads`, targeting at least 90% during the pilot.

**Rationale**: Explicit clocks, denominators and datasets prevent conflicting interpretations.

**Alternatives considered**: Average latency was rejected because it hides tail degradation; cache rate over every read was rejected because forced refreshes and expired entries are not cache-eligible.

## Decision 17: Use write-only administrative secret onboarding

**Decision**: An authorized administrator submits prepared credentials, P12/PFX and password once over TLS. The backend validates and transfers them to Vault/secret storage, persists only references/metadata, discards buffers and never returns secret values. The complete journey targets five minutes.

**Rationale**: This satisfies the clarified administrator flow while keeping stored secrets backend-only.

**Alternatives considered**: Infrastructure-only setup cannot satisfy the journey; encrypted blobs in public tenant tables increase exposure.

## Decision 18: Validate canonical fiscal primitives before enqueue

**Decision**: Normalize CPF/CNPJ to digit-only strings, preserve leading zeros, validate length/check digits, and reject invalid identifiers before persistence, enqueue or provider consumption. Shared helpers also own period, date and money semantics.

**Rationale**: Invalid work must not consume queue capacity or provider calls.

**Alternatives considered**: Provider-only validation was rejected due to cost, latency and inconsistent errors.

## Decision 19: Enforce domain readiness in CI

**Decision**: Each new fiscal domain fills a versioned template whose mandatory fields are validated by a repository script in CI before code tests.

**Rationale**: FR-036 becomes deterministic rather than advisory.

**Alternatives considered**: Manual PR checklist alone cannot reliably block omissions.

## External facts verified

- SERPRO authenticates with OAuth2 client credentials plus the contracting ICP-Brasil e-CNPJ and returns temporary access and JWT tokens.
- Requests use `/Apoiar`, `/Consultar`, `/Declarar`, `/Emitir` or `/Monitorar` and carry contractor, author, taxpayer and a service request envelope; `pedidoDados.dados` is serialized JSON text.
- Some services require e-CAC procurement; software-house-as-contractor uses the separate digitally signed Autentica Procurador flow.
- `X-Request-Tag` is optional, free text up to 32 characters and appears in detailed consumption reports.
- 202 and 204 may indicate asynchronous processing; the response supplies wait guidance.
- `/Apoiar` and `/Monitorar`, and documented HTTP error/status classes, are not billed; exact contracted prices remain pending.
- Last-update events remain available for up to 60 days. Current documented event limits are 1,000 PF and 1,000 PJ requests per event/day and 1,000 taxpayers per request; these values are configuration, not hardcoded domain rules.

## Sources

- SERPRO Integra Contador: https://apicenter.estaleiro.serpro.gov.br/documentacao/api-integra-contador/
- SERPRO authentication: https://apicenter.estaleiro.serpro.gov.br/documentacao/api-integra-contador/pt/quick_start/
- SERPRO general envelope: https://apicenter.estaleiro.serpro.gov.br/documentacao/api-integra-contador/pt/integra_contador/
- SERPRO services and procurations: https://apicenter.estaleiro.serpro.gov.br/documentacao/api-integra-contador/pt/servicos_vs_procuracoes/
- SERPRO return codes: https://apicenter.estaleiro.serpro.gov.br/documentacao/api-integra-contador/pt/codigos_retorno/
- SERPRO request tag: https://apicenter.estaleiro.serpro.gov.br/documentacao/api-integra-contador/pt/identificador_requisicoes/
- SERPRO events: https://apicenter.estaleiro.serpro.gov.br/documentacao/api-integra-contador/pt/solucoes/integra-contador-gerenciador/eventosatualizacao/
- Supabase Queues: https://supabase.com/docs/guides/queues
- Supabase scheduled Edge Functions: https://supabase.com/docs/guides/functions/schedule-functions
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security

No unresolved `NEEDS CLARIFICATION` remains. Items marked `EXTERNAL_CONTRACT_PENDING` are isolated provider facts that must be verified against the contracted environment before enabling the real provider; they do not block architecture or fake-provider implementation.

## Production contract gate (T080)

The real adapter remains disabled. Completion requires evidence from the contracted SERPRO validation environment, never public examples or inferred constants.

| Gate | Status | Evidence required |
| --- | --- | --- |
| Pilot `idSistema`, `idServico`, `versaoSistema` | `EXTERNAL_CONTRACT_PENDING` | Contracted catalog/Swagger and successful allowlisted request |
| JWT header (`jwt_token` versus `x-jwt-assertion`) | `EXTERNAL_CONTRACT_PENDING` | Redacted successful validation request and contracted documentation |
| Procuration/service authorization codes | `EXTERNAL_CONTRACT_PENDING` | Active e-CAC grants and validation response |
| Rate, quota, billing unit/price and `Retry-After` | `EXTERNAL_CONTRACT_PENDING` | Contract/consumption report and controlled limit test |
| Edge Runtime P12/PFX mTLS | `EXTERNAL_CONTRACT_PENDING` | Dated handshake/authenticated request, or approved dedicated proxy fallback |

Owner: integration technical lead with fiscal administrator approval. Review before validation and again before production.

## Official SERPRO Trial mode

The demonstration environment is a third, isolated provider mode (`trial`), not the local fake and not production. It uses `https://gateway.apiserpro.serpro.gov.br/integra-contador-trial/v1`, the public Bearer published in the Trial Swagger, no OAuth/mTLS, and no required `jwt_token`. The Caixa Postal indicator demonstration calls `POST /Monitorar` with `CAIXAPOSTAL / INNOVAMSG63 / 1.0` and SERPRO-owned simulated identities. Those deliberately non-real identifiers bypass canonical CPF/CNPJ validation only inside the Trial adapter and are never persisted as client identity.

Trial remains forbidden when `INTEGRA_CONTADOR_ENVIRONMENT=production`; it supports manual demonstration only and does not prove contract, procuration, billing, production JWT-header, or mTLS gates in T080.
# DCTFWeb derived increment — research addendum (2026-08-21)

- **Decision**: deliver consultation and assisted DARF generation before transmission. **Rationale**: validates the six official Trial contracts while limiting irreversible fiscal effects. **Alternatives**: immediate full transmission was rejected because it requires a signed XML and external closure/signing dependencies.
- **Decision**: operate entirely inside the canonical obligation task. **Rationale**: tasks and obligation instances already own assignment, due date, completion and document delivery. **Alternatives**: a separate DCTFWeb module would create a competing operational queue.
- **Decision**: model the provider category as a versioned domain value. **Rationale**: official examples use category representations inconsistently across services; leaking them into UI/database contracts would be brittle.
- **Decision**: keep signed/raw XML out of database logs and normal response payloads. **Rationale**: XML is sensitive, large and may contain a digital signature; store only encrypted/private artifacts plus hashes and normalized facts.
- **Decision**: treat transmission timeout as unknown, not failed. **Rationale**: repeating an externally effective request without consulting state can duplicate effects.
- **Official Trial mapping**: `GERARGUIA31`, `GERARGUIAANDAMENTO313`, `CONSRECIBO32`, `CONSDECCOMPLETA33`, `CONSXMLDECLARACAO38`, `TRANSDECLARACAO310`, all under system `DCTFWEB`, version `1.0`.
