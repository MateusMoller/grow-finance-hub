# Data Model: Integra Contador — Fundação e Sincronização Fiscal Inicial

## Reuse map

| Concept requested by the specification | Existing owner | Decision |
|---|---|---|
| Companies | `public.clients` + `public.organizations` | Reuse; do not create `companies`. |
| Fiscal obligations | `public.obligation_instances`, templates, profiles and events | Reuse for operational obligations; add integration references only when facts are matched. |
| Fiscal documents | `public.obligation_instance_files` + private `obligation-files` bucket | Reuse for obligation-bound artifacts; add `fiscal_documents` metadata for provider documents not yet matched. |
| Tasks | `public.kanban_tasks` and canonical task action | Reuse; integrations create/update through system-origin contract. |
| Audit | `public.operational_audit_logs` and obligation audit events | Reuse business audit; do not duplicate generic audit. |
| Integration credentials | `integration_api_credentials` | Do not reuse; it stores Grow-issued user API-token hashes, not provider secrets. |
| Scheduled execution | `pg_cron`, `pg_net`, Vault invocation secret | Reuse. |
| Durable queue | None | Enable private, logged Supabase Queue/PGMQ and add tenant-aware job metadata. |

## Schema boundaries

- `public`: tenant-scoped operational/read models that may be queried through controlled RLS.
- `private`: decrypted token cache, secret-resolution helpers, queue/claim helpers and privileged provider metadata not exposed by the Data API.
- `vault`: long-lived secrets and certificate material; referenced, never copied into `public`.
- `pgmq`: internal logged queues; not exposed through `pgmq_public` to application roles.
- Storage: private fiscal documents only; certificate material is not stored in user-addressable buckets.

## Canonical fiscal primitive validation

- CPF is stored as 11-character digit-only text and CNPJ as 14-character digit-only text; leading zeros are significant.
- Backend normalizers remove presentation punctuation and validate length/check digits before any fiscal row, fingerprint, queue message or provider request.
- Invalid identifiers return a safe validation result and create no external usage record.
- Database checks reinforce digit-only length; algorithmic validation remains in the shared backend helper.
- Periods, dates and money use shared canonical serializers before hashing or domain mapping.

## 1. `public.integra_contador_connections`

**Purpose**: One connection configuration per organization and environment.

| Field | Type | Rules |
|---|---|---|
| `id` | uuid | PK |
| `organization_id` | uuid | FK organizations, required |
| `environment` | text | `development`, `validation`, `production` |
| `contractor_tax_id` | text | Valid canonical CNPJ string |
| `status` | text | `disabled`, `pending`, `validating`, `active`, `requires_action`, `failed` |
| `credential_secret_ref` | text | Vault reference name/id, never secret value |
| `certificate_secret_ref` | text | Vault reference name/id |
| `certificate_expires_at` | timestamptz | Nullable until validated |
| `enabled_capabilities` | text[] | Allowlisted registry keys |
| `last_health_check_at` | timestamptz | Nullable |
| `last_success_at` | timestamptz | Nullable |
| `last_error_code` | text | Sanitized nullable code |
| `created_by`, `updated_by` | uuid | FK auth.users, nullable on deletion |
| timestamps | timestamptz | Required |

**Constraints/indexes**:

- Unique `(organization_id, environment)`.
- Check environment/status fixed values.
- Index `(organization_id, status)`.
- Index certificate expiry where connection is active.

**Access**: Admin/integration-manager read sanitized row; mutation only through protected backend action. Portal/anon denied.

**Retention**: Keep configuration history in audit after removal; hard deletion only during controlled tenant teardown.

## 2. `public.fiscal_procurations`

**Purpose**: Cache verified ability of an author/procurator to execute a registered capability for a taxpayer.

| Field | Type | Rules |
|---|---|---|
| `id` | uuid | PK |
| `organization_id` | uuid | FK organizations |
| `client_id` | uuid | FK clients |
| `connection_id` | uuid | FK connection |
| `author_tax_id` | text | Canonical CPF/CNPJ |
| `taxpayer_tax_id` | text | Canonical CPF/CNPJ |
| `capability_key` | text | Registry key, not raw scattered external code |
| `status` | text | `unknown`, `valid`, `missing`, `expired`, `insufficient`, `pending_validation` |
| `valid_from`, `valid_until` | timestamptz | Nullable |
| `verified_at` | timestamptz | Required when non-unknown |
| `external_reference_hash` | text | Optional non-reversible reference |
| `metadata_min` | jsonb | Sanitized, bounded |
| timestamps | timestamptz | Required |

**Constraints/indexes**:

- Unique `(organization_id, client_id, author_tax_id, taxpayer_tax_id, capability_key)`.
- Index `(organization_id, status, valid_until)`.
- Index all FK columns.

**Retention**: Current row plus operational audit; no full signed term in the MVP.

## 3. `public.fiscal_sync_runs`

**Purpose**: User-visible and auditable synchronization execution.

| Field | Type | Rules |
|---|---|---|
| `id` | uuid | PK; also stable job id |
| `organization_id` | uuid | FK organizations |
| `client_id` | uuid | FK clients, nullable only for organization batch/monitor |
| `connection_id` | uuid | FK connection |
| `capability_key` | text | Registry key |
| `reason` | text | `user_request`, `monitor_event`, `scheduled_reconciliation`, `initial_import`, `retry`, `admin_reprocess` |
| `status` | text | `queued`, `processing`, `waiting_external`, `completed`, `failed`, `requires_action`, `cancelled` |
| `requested_by` | uuid | FK auth.users, nullable for system |
| `source` | text | `internal_app`, `monitor`, `schedule`, `system`, `admin` |
| `correlation_id` | uuid | Required |
| `request_fingerprint` | text | Canonical SHA-256 |
| `attempt_count`, `max_attempts` | integer | Non-negative, bounded |
| `next_attempt_at` | timestamptz | Nullable |
| `external_protocol` | text | Nullable; asynchronous provider reference |
| `external_wait_until` | timestamptz | Nullable |
| `records_received`, `records_changed` | integer | Non-negative |
| `error_code`, `error_category` | text | Sanitized nullable |
| `error_summary` | text | Sanitized and bounded |
| `started_at`, `finished_at` | timestamptz | Nullable |
| timestamps | timestamptz | Required |

**Constraints/indexes**:

- Partial unique index preventing more than one active run for `(organization_id, client_id, capability_key, request_fingerprint)` where status is queued/processing/waiting.
- Queue index `(status, next_attempt_at, created_at)` for active states.
- User list index `(organization_id, created_at desc, id desc)`.
- Client list index `(organization_id, client_id, created_at desc)`.
- Check state/timestamps/attempt counts.

**Retention**: Detailed successful runs 24 months; failures and audit references according to fiscal incident policy. Summaries may be retained longer.

## 4. `public.fiscal_operations`

**Purpose**: Backend idempotency ledger for any operation that may create an external effect; established now even though the pilot is read-only.

| Field | Type | Rules |
|---|---|---|
| `id` | uuid | PK |
| `organization_id`, `client_id` | uuid | Tenant/client FKs |
| `capability_key`, `operation` | text | Internal domain vocabulary |
| `period_key` | text | Nullable canonical fiscal period |
| `idempotency_key` | text | Required opaque key |
| `request_hash` | text | Required SHA-256 |
| `status` | text | `reserved`, `processing`, `waiting_external`, `completed`, `failed`, `requires_action` |
| `external_reference` | text | Nullable |
| `correlation_id` | uuid | Required |
| timestamps | timestamptz | Required |

**Constraints/indexes**:

- Unique `(organization_id, idempotency_key)`.
- Index `(organization_id, client_id, operation, period_key)`.
- Check fixed states.

**Concurrency**: Reserve with atomic insert/upsert; never SELECT then INSERT. External I/O occurs outside a long transaction. Final transition uses expected current status.

## 5. `public.fiscal_request_cache`

**Purpose**: Persist normalized read results and deduplicate equivalent external queries.

| Field | Type | Rules |
|---|---|---|
| `id` | uuid | PK |
| `organization_id`, `client_id` | uuid | FKs |
| `capability_key` | text | Required |
| `period_key` | text | Nullable |
| `request_fingerprint` | text | Required |
| `cache_category` | text | `static`, `semi_static`, `transactional`, `real_time` |
| `normalized_result` | jsonb | Validated DTO only |
| `result_hash` | text | Required |
| `source_updated_at` | timestamptz | Nullable |
| `fetched_at`, `valid_until` | timestamptz | Required |
| `last_usage_id` | uuid | Nullable FK usage |
| timestamps | timestamptz | Required |

**Constraints/indexes**:

- Unique `(organization_id, client_id, capability_key, request_fingerprint)`.
- Partial/compound index for valid lookup `(organization_id, client_id, capability_key, valid_until)`.
- GIN is not added to `normalized_result` until a measured query requires it.

**Retention**: Replaced entries may move to domain history where required; cache itself is not the legal record.

## 6. `public.receita_event_states`

**Purpose**: Track last provider update and local processing for each taxpayer/topic.

| Field | Type | Rules |
|---|---|---|
| `id` | uuid | PK |
| `organization_id`, `client_id`, `connection_id` | uuid | FKs |
| `taxpayer_tax_id` | text | Canonical string |
| `event_type` | text | Registry-controlled |
| `remote_updated_at` | timestamptz | Nullable |
| `last_checked_at` | timestamptz | Required |
| `last_processed_at` | timestamptz | Nullable |
| `status` | text | `unchanged`, `changed`, `queued`, `processed`, `failed`, `requires_action` |
| `external_protocol` | text | Nullable |
| `metadata_min` | jsonb | Sanitized limits/balance only |
| timestamps | timestamptz | Required |

**Constraints/indexes**:

- Unique `(organization_id, client_id, event_type)`.
- Monitor scan `(organization_id, status, remote_updated_at)`.
- Index all FKs.

**Transition rule**: `remote_updated_at > last_processed_at` moves to changed/queued and produces one sync fingerprint.

## 7. `public.serpro_api_usage`

**Purpose**: One immutable attempt record for consumption, latency and external-report reconciliation.

| Field | Type | Rules |
|---|---|---|
| `id` | uuid | PK/request id |
| `organization_id`, `client_id` | uuid | FKs; client nullable for batch/auth |
| `sync_run_id`, `operation_id` | uuid | Nullable FKs |
| `correlation_id` | uuid | Required |
| `request_tag` | text | <= 32 chars |
| `capability_key`, `action` | text | Required |
| `source` | text | Required |
| `http_status` | integer | Nullable on transport failure |
| `duration_ms` | integer | Non-negative |
| `cache_hit`, `success`, `billable` | boolean | Required |
| `error_type` | text | Nullable normalized category |
| `billing_class` | text | Nullable |
| `estimated_cost` | numeric(14,6) | Nullable, never float |
| `started_at`, `finished_at`, `created_at` | timestamptz | Required |

**Constraints/indexes**:

- Unique request tag per connection/time strategy where practical; tag uniqueness is internal, not external idempotency.
- Dashboard index `(organization_id, created_at desc)`.
- Aggregation index `(organization_id, capability_key, created_at desc)`.
- Error partial index `(organization_id, http_status, created_at desc)` where success=false.

**Retention**: Raw attempt rows 24 months; aggregate cost metrics may be retained longer. No request/response body.

## 8. `public.fiscal_documents`

**Purpose**: Provider fiscal-document metadata before or independent of obligation matching.

| Field | Type | Rules |
|---|---|---|
| `id` | uuid | PK |
| `organization_id`, `client_id` | uuid | FKs |
| `obligation_instance_id` | uuid | Nullable FK existing obligation |
| `document_type` | text | DAS, DARF, receipt, extract, declaration, proof, report |
| `period_key` | text | Nullable canonical period |
| `source` | text | `integra_contador` |
| `external_reference` | text | Nullable |
| `content_hash` | text | Required when file exists |
| `storage_bucket`, `storage_path` | text | Nullable until file stored |
| `issued_at`, `expires_at` | timestamptz | Nullable |
| `metadata_min` | jsonb | Sanitized |
| `portal_published_at`, `portal_published_by` | timestamp/uuid | Nullable; no automatic publication |
| timestamps | timestamptz | Required |

**Constraints/indexes**:

- Unique `(organization_id, client_id, source, external_reference)` when reference is present.
- Unique `(organization_id, client_id, content_hash)` when hash is present.
- Index `(organization_id, client_id, period_key, document_type)`.
- Index obligation FK.

**Storage**: Private bucket/path begins with organization/client; signed URLs are short-lived. A file matched to an obligation may reuse the existing obligation artifact contract.

## 9. `public.caixa_postal_indicators`

**Purpose**: Normalized read model for the pilot, without storing message content.

| Field | Type | Rules |
|---|---|---|
| `id` | uuid | PK |
| `organization_id`, `client_id` | uuid | FKs |
| `taxpayer_tax_id` | text | Canonical string |
| `has_new_messages` | boolean | Required |
| `indicator_code` | text | Nullable normalized provider indicator |
| `source_updated_at` | timestamptz | Nullable |
| `last_synced_at` | timestamptz | Required |
| `last_sync_run_id` | uuid | FK sync run |
| `requires_action` | boolean | Default false |
| timestamps | timestamptz | Required |

**Constraints/indexes**:

- Unique `(organization_id, client_id)`.
- Dashboard index `(organization_id, has_new_messages, last_synced_at desc)`.
- Client FK indexed.

**Retention**: Current indicator plus sync/audit history. Message list/content is not part of this table or pilot.

## 10. `private.integra_contador_token_cache`

**Purpose**: Shared encrypted temporary token and refresh-lease state.

| Field | Type | Rules |
|---|---|---|
| `connection_id` | uuid | PK/FK connection |
| encrypted access/JWT token fields | bytea/text | Ciphertext only |
| `expires_at` | timestamptz | Required |
| `refresh_owner` | uuid | Nullable worker id |
| `refresh_locked_until` | timestamptz | Nullable short lease |
| `refreshed_at`, `updated_at` | timestamptz | Required |

**Access**: No Data API exposure. Only private functions/service-role backend. Secrets are redacted from function results except to the provider caller inside the backend.

**Concurrency**:

1. Read valid token.
2. If refresh needed, atomically claim an expired refresh lease.
3. Winner authenticates outside the DB transaction.
4. Winner writes encrypted tokens and clears lease.
5. Losers wait bounded time, then read refreshed token or fail controlled.

## 11. `public.fiscal_reviews`

**Purpose**: Exceptions requiring human action without duplicating task management.

| Field | Type | Rules |
|---|---|---|
| `id` | uuid | PK |
| `organization_id`, `client_id` | uuid | FKs |
| `sync_run_id` | uuid | Nullable FK |
| `review_type`, `reason_code` | text | Controlled |
| `status` | text | `open`, `in_review`, `resolved`, `dismissed` |
| `recommended_action` | text | Sanitized business text |
| `task_id` | uuid | Nullable FK kanban task |
| `resolved_by`, `resolved_at` | uuid/timestamptz | Nullable |
| `resolution` | jsonb | Sanitized, bounded |
| timestamps | timestamptz | Required |

**Constraints/indexes**:

- Partial unique fingerprint for one open review per logical external issue.
- Queue index `(organization_id, status, created_at)`.
- FKs indexed.

**Rule**: Creating a task is optional and occurs only for concrete human work through the canonical task action; the review remains the fiscal exception record.

## Queue model

### PGMQ `fiscal-sync`

Message contains only:

```json
{
  "jobId": "uuid",
  "organizationId": "uuid",
  "clientId": "uuid",
  "capabilityKey": "caixa_postal.new_message_indicator",
  "correlationId": "uuid"
}
```

### PGMQ `fiscal-monitor`

Message contains batch/connection identifiers and correlation only. Contributor identifiers are loaded after tenant validation from the database.

### Rules

- Logged queues only.
- Queue schemas remain backend-private.
- Visibility timeout exceeds one worker slice but stays below stale-job recovery threshold.
- Message deletion/archive occurs only after durable job transition.
- Poison messages reach failed/dead-letter operational state after bounded attempts.
- Queue retries never bypass `fiscal_operations` idempotency or active-run uniqueness.

## RLS and grants

- Enable RLS on all new `public` tables.
- Explicitly revoke `anon`; grant only required table operations to `authenticated` after confirming Data API exposure settings.
- Internal read policies use canonical organization access and module/capability checks.
- Direct writes to connection, sync, usage, operation, event, cache and review tables are denied to frontend roles; protected Edge Functions/RPCs own mutations.
- Portal receives no policy in the MVP. Future published-document reads require both `portal_published_at` and active `client_users` membership.
- Complex `SECURITY DEFINER` helpers live in non-exposed `private`, set an empty/controlled `search_path`, validate identity where user-callable and revoke execute from `PUBLIC`, `anon` and unrelated roles.
- Index every organization/client column used by RLS; wrap stable auth helpers in scalar subqueries where applicable.

## Migration order

1. Validate required extensions and create private schema/secret helper grants.
2. Add connection and procurement tables plus feature flags/capability permissions.
3. Add sync runs, operations, cache, event state, usage and review tables with RLS/grants.
4. Add fiscal document metadata and private storage policy changes if needed by later slice.
5. Add pilot `caixa_postal_indicators` read model.
6. Create logged PGMQ queues and private queue helper functions.
7. Add worker/monitor Vault invocation secrets, scheduler functions and cron entries.
8. Regenerate Supabase types and run advisors/RLS tests.

Constraints are created with explicit existence checks where PostgreSQL lacks `ADD CONSTRAINT IF NOT EXISTS`. Foreign keys receive indexes. Large validation constraints may be added `NOT VALID` then validated separately if production volume makes locking material.

## Rollback

- Disable all Integra Contador feature flags first.
- Unschedule cron jobs and stop worker invocations.
- Drain/archive or quarantine queue messages; never silently drop in-flight operations.
- Preserve fiscal results, documents, usage and audit records by default.
- Revert frontend/routes/functions independently.
- Drop new queues/tables only in a separate approved destructive migration after export/retention review.
- Vault secrets are revoked/deleted through operational runbook, not exposed in migration logs.
# DCTFWeb derived increment — data model addendum

## `public.dctfweb_dossiers`

One row per organization, client, competence and category. Links the canonical `obligation_instance_id`, records `status`, `data_version`, approved version/actor/time, receipt number, provider state, signed XML hash/path and timestamps. Unique `(organization_id, client_id, competence_key, category)` and unique active link to the obligation instance.

## `public.dctfweb_operations`

Append-only operation ledger with dossier, task, actor, service key, provider route, request fingerprint, idempotency key, status, request tag, HTTP/provider codes, timing, attempts and sanitized error. Raw XML, tokens and credentials are prohibited.

## `public.dctfweb_artifacts`

Metadata for `xml`, `receipt`, `complete_report` and `darf`: organization/client/dossier/instance, private storage path, SHA-256, MIME, byte size, provider reference and creation time. Unique active content hash per dossier/type prevents duplicate documents.

## State invariants

- Only the approved `data_version` can be transmitted.
- DARF for a transmitted declaration requires a receipt number; in-progress guide does not.
- A task/obligation is never completed solely from an HTTP success; required artifacts and normalized provider state must be persisted first.
- Cross-tenant links and storage paths are rejected by constraints/RLS/backend checks.
