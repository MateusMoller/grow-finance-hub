# Contract: Security Baseline Evidence

This contract defines the evidence each implementation task must produce for
the security baseline. It is a project contract, not a public API.

## Protected Surface Record

Each protected surface must be documented with:

```yaml
surface:
  type: table | bucket | route | edge_function | webhook | integration | auth_setting | deploy_setting | operation
  name: string
  data_classification: public | internal | client_portal | sensitive
  affected_modules:
    - string
  organization_scoped: boolean
  client_scoped: boolean
  owner_layer: frontend | rls | storage_policy | edge_function | deploy_config | supabase_config | operations
  risk_level: low | medium | high | critical
  review_owner: string
  review_due_date: YYYY-MM-DD
  evidence_path: string
  validation_status: missing | planned | validated | blocked | deferred
```

Acceptance rules:
- Critical/high-risk surfaces require `evidence_path` and a non-missing
  validation status in the first baseline round.
- Medium-risk surfaces require `review_due_date` no later than 60 days from
  classification.
- Low-risk surfaces require `review_due_date` no later than 90 days from
  classification.
- Possible cross-tenant/cross-client exposure, service-role or secret use
  without strong validation, or improperly accessible private Storage must be
  classified as critical until proven otherwise.

## Authorization Evidence

For every protected action:

```yaml
authorization:
  action: select | insert | update | delete | upload | download | invoke | receive_webhook | generate_report | manage_user | manage_secret
  allowed_roles:
    - admin
    - director
    - manager
    - employee
    - commercial
    - partner
    - departamento_pessoal
    - fiscal
    - contabil
    - client
  organization_rule: string
  client_rule: string
  backend_enforced: boolean
  frontend_affordance_only: boolean
  legacy_fallback: none | portal_user_id | documented_other
  evidence:
    file_paths:
      - string
    validation_steps:
      - string
```

Acceptance rules:
- `backend_enforced` must be true for sensitive actions.
- `frontend_affordance_only` cannot be the only control for sensitive actions.
- `legacy_fallback` must not be used without a migration or retirement note.
- Any action with possible cross-tenant/cross-client exposure must be marked
  critical in the protected surface record.

## Storage Evidence

For every bucket or file workflow:

```yaml
storage:
  bucket: string
  public: boolean
  allowed_mime_types:
    - string
  blocked_extensions:
    - string
  max_file_size_mb: number
  path_scope: string
  signed_url_ttl_seconds: number
  upload_audit: boolean
  download_audit: boolean
  retention_policy: string
```

Acceptance rules:
- Sensitive document buckets must have `public: false`.
- Sensitive download flows must use scoped authorization and short-lived
  access.
- Upload and download events for sensitive documents must be auditable.

## Edge Function Evidence

For every privileged Edge Function:

```yaml
edge_function:
  name: string
  verify_jwt: boolean
  public_webhook: boolean
  validates_jwt_user: boolean
  validates_role: boolean
  validates_organization: boolean
  validates_client: boolean
  validates_payload_schema: boolean
  uses_service_role: boolean
  rate_limit_or_quota: none | auth_setting | app_level | provider_level
  audit_or_log_table: string
  failure_mode: fail_closed | controlled_noop | public_ack_then_review
```

Acceptance rules:
- If `uses_service_role` is true and `public_webhook` is false, JWT and role
  validation are required.
- If `public_webhook` is true, provider signature/challenge verification and
  idempotency evidence are required.
- Failure mode must not leak secrets or sensitive payloads.

## Operational Evidence

For each environment:

```yaml
environment_controls:
  environment: development | staging | production
  separate_database: boolean
  separate_keys: boolean
  production_data_in_lower_envs: none | masked | real
  backups_enabled: boolean
  restore_tested: boolean
  pitr_required: boolean
  dashboard_mfa_required: boolean
  access_review_frequency: string
  redirect_urls_reviewed: boolean
  auth_rate_limits_reviewed: boolean
  session_policy_reviewed: boolean
```

Acceptance rules:
- Production must use separate database and keys.
- Production access review must have an explicit cadence.
- Real production data in lower environments requires masking or written risk
  acceptance.

## Repository Artifact Contract

The first baseline must be reviewable without database persistence.

Required files:

```yaml
repository_artifacts:
  root: docs/security/
  required:
    - security-control-matrix.md
    - security-validation-runbook.md
    - operational-security-settings.md
    - security-risk-classification.md
```

Acceptance rules:
- Baseline source of truth for the first increment is `docs/security/`.
- New database tables or admin UI are optional follow-up work and must not block
  first baseline completion.

## Validation Report

Every implementation pass must report:

```yaml
validation:
  commands_run:
    - npm run lint
    - npm run test
    - npm run build
    - npm run verify:deploy
  commands_blocked:
    - command: string
      reason: string
  manual_scenarios:
    - scenario: string
      result: pass | fail | blocked
      evidence: string
  residual_risks:
    - risk: string
      owner: string
      target_resolution: string
```
