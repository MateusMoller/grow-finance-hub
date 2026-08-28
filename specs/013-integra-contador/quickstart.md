# Quickstart: Implementing the Integra Contador Foundation

This is an implementation/verification runbook for the plan, not production credentials documentation.

## 1. Preconditions

- Work on branch `013-integra-contador`.
- Keep `SPEC_CONTEXT=INTEGRACAO_INTEGRA_CONTADOR` visible in derived artifacts.
- Confirm Node 22.12+, Supabase CLI version and local stack availability.
- Obtain no production secret for automated/local tests.
- Verify the contracted SERPRO catalog before enabling the real provider; unresolved identifiers remain `EXTERNAL_CONTRACT_PENDING`.

## 2. Create migrations safely

Regenerate `src/integrations/supabase/types.ts` after the final migration of every delivered increment; never treat an earlier generated snapshot as complete for later story migrations.

Use the CLI help first, then create migrations with the Supabase migration command. Do not invent migration history filenames by hand during implementation.

Suggested migration sequence:

1. connection/procuration/feature capabilities;
2. sync/operation/cache/event/usage/review entities;
3. Caixa Postal indicator read model;
4. logged PGMQ queues and private claim/token helpers;
5. Vault-backed scheduler invocation functions and cron jobs;
6. storage changes only when a document-producing slice is introduced.

Every public table requires explicit grants plus RLS. Queue and private schemas are not exposed to frontend consumers.

## 3. Implement core behind interfaces

Start with:

```text
IntegraContadorProvider
FakeIntegraContadorProvider
ServiceRegistry
AuthorizationResolver
ErrorMapper
RetryPolicy
RequestTagFactory
UsageTracker
AuditLogger
FiscalQueue
```

Then implement real transport/auth/certificate/token components. No fiscal domain may call `fetch` directly.

Implement shared CPF/CNPJ normalization (digit-only text, leading zeros, length/check-digit validation) before persistence, fingerprinting, enqueue or provider access. Keep canonical period, date and money serialization beside it. Add the versioned fiscal-domain template and run its validator in CI before domain code tests.

## 4. Implement the pilot vertical slice

Capability:

```text
caixa_postal.new_message_indicator
```

Flow:

```text
authenticated internal action
→ tenant/client/capability validation
→ cache/fingerprint lookup
→ sync run + queue message
→ worker claim
→ authorization resolution
→ provider/fake execution
→ response normalization
→ indicator/cache persistence
→ usage + audit
→ safe UI status
```

Message list/content is not included.

## 5. Configure environments

- Local/test: fake provider and fixtures only.
- Validation: separate contracted/test credentials and certificate.
- Production: dedicated Vault secrets and production connection row.
- Never place SERPRO values in `VITE_*`, browser storage, source files, fixtures or logs.
- Exercise write-only onboarding: submit prepared key/secret, P12/PFX and password over TLS, transfer to Vault, discard buffers and verify no read response returns the values.

## 6. Verify security

- Anon cannot access any new table/function/queue.
- Portal user cannot access integration entities or indicator in MVP.
- Internal user from another organization cannot read or enqueue.
- Fiscal read does not imply sync/reprocess/manage.
- Service-role Edge Functions revalidate JWT/organization/client/action.
- Private helpers revoke execute from `PUBLIC`, `anon`, `authenticated` unless narrowly required.
- Logs and audit contain no secret/token/certificate/raw message.

## 7. Verify concurrency and resilience

- Twenty concurrent workers cause one token refresh.
- Duplicate click/event/job causes one active sync and one final indicator.
- Worker crash before acknowledgment leads to safe redelivery.
- 202/204 wait and resume without marking failure.
- 401 refreshes once only.
- 403/procuration/certificate becomes `requires_action`.
- 429/5xx/timeouts use bounded schedule and no infinite retry.
- Stale data remains visibly dated during provider outage.

## 8. Test layers

- Unit/Vitest or Deno: canonical serialization, hashing, service registry, mappings, errors, redaction, retry decisions, token lease.
- Contract fixtures: SERPRO envelope and response samples; malformed input fails closed.
- SQL/pgTAP: constraints, RLS, grants, private helper execution, job transitions and deduplication.
- Integration: fake provider through Edge Function to persistence/audit/usage.
- UI/Testing Library: status, action-required guidance, polling stop and permissions.
- Playwright: admin health screen and client fiscal indicator flow.
- Canonical primitives: punctuation, leading zeros, valid/invalid check digits and rejection before queue/provider.
- Usability/security: prepared administrator completes configure-and-test within five minutes and secret sentinels are absent from responses, logs and tenant tables.
- Performance/SLO: 5,000-client reference load with p95 ≤2 seconds; cache hits ≥90% of eligible pilot reads; eligible syncs terminal/action-required within 15 minutes in at least 95% of cases.

## 9. Quality gates

Run:

```text
npm run lint
npm run test
npm run build
npm run verify:deploy
```

Also run Supabase migration/RLS tests, Edge Function contract tests and database advisors in a linked validation environment. Record any unavailable local gate.

## 10. Rollout

1. Fake provider only.
2. Validation environment connection test.
3. Internal tenant with feature disabled by default.
4. Enable connection health for admins.
5. Enable pilot for a small allowlisted client cohort.
6. Measure calls, cache, errors and manual e-CAC reduction.
7. Expand cohort only after security, cost and idempotency gates pass.
8. Specify list/detail messages, Payments and DCTFWeb separately.

## 11. Phase 7/8 verification record

| Scenario | Verification |
| --- | --- |
| Monitoring security | Tenant membership protects reads; reprocessing requires admin permission and creates an immutable child run. |
| Normalization/minimization | Fiscal primitives are canonicalized before queue/provider boundaries; the pilot stores a boolean indicator, not raw message content. |
| SLO/pagination | The 5,000-client workload records p50/p95/p99, unique cursor identity, cache ratio and terminal-within-15-minute ratio. Production must also capture DB `EXPLAIN` and observed queue age. |
| Retention | A private daily cleanup removes expired cache/usage detail and redacts old provider references/error summaries. |
| Domain gate | The versioned domain template remains mandatory. Message list/content, Payments and DCTFWeb are separate scopes. |
| Deployment | Fake → validation → production, flags, kill switch, rotation, mTLS proxy fallback and rollback are defined in `docs/runbooks/integra-contador.md`. |
| Real provider | Blocked until every T080 item has dated evidence; this is a release safety result. |
# DCTFWeb derived increment — verification quickstart

1. Keep the organization capability disabled by default and use Trial fixtures only.
2. Open a canonical DCTFWeb obligation task; verify exactly one dossier is prepared for its client and competence.
3. Exercise XML, receipt and complete-report consultations and confirm private artifact storage plus short-lived downloads.
4. Generate a transmitted DARF and an in-progress guide; repeat each action and confirm no duplicate provider effect or file link.
5. Verify that transmission stays blocked without approved version, signed XML, permission and feature flag.
6. Simulate timeout after submission and confirm `transmission_unknown`, with no blind repeat.
7. Run cross-tenant RLS tests and regressions for PGDAS-D, DEFIS and generic tasks.
8. Run `npm run verify:deploy`, Deno contract tests and Supabase SQL tests before rollout.
