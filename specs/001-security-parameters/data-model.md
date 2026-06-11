# Data Model: Parametros Gerais de Seguranca

## Existing Entities To Reuse

### Organization

Represents a tenant boundary.

Key fields:
- `id`
- `slug`
- `name`
- `is_active`

Relationships:
- Has many `organization_settings`
- Has many `user_roles`
- Has many `client_users`
- Owns operational records through `organization_id`

Validation rules:
- Operational data must reference an organization unless explicitly public.
- The active organization must be resolved before tenant-scoped writes.

### User Role

Represents the user's role in an organization.

Key fields:
- `user_id`
- `organization_id`
- `role`

Allowed roles:
- `admin`
- `director`
- `manager`
- `employee`
- `commercial`
- `partner`
- `departamento_pessoal`
- `fiscal`
- `contabil`
- `client`

Validation rules:
- Role checks must be scoped to organization.
- User-editable metadata must not be trusted for authorization.
- Administrative role changes must be audited.

### Client User

Represents the portal/user-to-client authorization boundary.

Key fields:
- `organization_id`
- `client_id`
- `user_id`
- `status`

Relationships:
- Belongs to one organization
- Belongs to one client
- Belongs to one user

Validation rules:
- Portal reads/writes must use active client membership.
- Legacy `clients.portal_user_id` fallback must be documented per flow.

### Organization Settings

Represents tenant-level operational configuration.

Key fields:
- `organization_id`
- `feature_flags`
- integration/security setting fields as currently available

Validation rules:
- Feature checks must be scoped to organization.
- Sensitive integration settings must not be exposed to the frontend.

### Operational Audit Log

Represents evidence for sensitive actions.

Key fields:
- `organization_id`
- `actor_user_id`
- `action`
- `entity_type`
- `entity_id`
- `metadata`
- `created_at`

Validation rules:
- Must not store secrets, access tokens, full document contents, or raw private
  external payloads unless explicitly required and protected.
- Sensitive action logs must include enough context to identify actor, scope,
  target and result.

## New Planning Entities

These are implemented first as versioned Markdown artifacts under
`docs/security/`. Database persistence is a later enhancement and must not block
the first inventory and validation pass.

### Security Control Matrix

Purpose: authoritative inventory of protected surfaces and their required
controls.

Fields:
- `surface_type`: route, table, bucket, function, webhook, integration, deploy
  setting, auth setting, operational process
- `surface_name`
- `data_classification`: public, internal, portal, sensitive
- `organization_scoped`: boolean
- `client_scoped`: boolean
- `allowed_roles`
- `blocked_roles`
- `required_controls`: RLS, storage policy, Edge Function auth, signed URL,
  rate limit, audit log, CSP/header, backup, access review
- `current_state`: compliant, partial, missing, unknown
- `risk_level`: low, medium, high, critical
- `owner_layer`: migration/RLS, Edge Function, frontend, deploy config,
  Supabase project config, operations
- `evidence_path`: file, query, dashboard setting, test, checklist, or runbook
- `review_owner`
- `review_due_date`
- `rollout_status`: planned, staged, validated, production, deferred

Validation rules:
- Every sensitive surface must have at least one backend or platform control.
- Every high/critical risk item must have evidence in the first baseline round.
- Every medium-risk item must have a review due date no later than 60 days.
- Every low-risk item must have a review due date no later than 90 days.
- Any possible cross-tenant/cross-client exposure, service-role or secret use
  without strong validation, or improperly accessible private Storage is
  critical until evidence proves otherwise.
- Public surfaces must prove absence of internal-only data dependencies.

### Security Policy Requirement

Purpose: normalized requirement for a protected action.

Fields:
- `action`: select, insert, update, delete, upload, download, invoke,
  webhook_receive, report_generate, auth_redirect, session_control
- `subject_role`
- `organization_rule`
- `client_rule`
- `resource_type`
- `resource_id_strategy`
- `audit_required`
- `rate_limit_required`
- `confirmation_required`
- `human_review_required`

Validation rules:
- Sensitive writes require audit.
- Medium/high risk automation requires confirmation or human review.
- Service-role operations require Edge Function ownership and JWT/action
  validation unless they are external webhooks, which require signature or
  provider-specific verification.

### Private Document Policy

Purpose: standardize private file handling.

Fields:
- `bucket`
- `document_classification`
- `allowed_mime_types`
- `blocked_extensions`
- `max_file_size`
- `path_scope`: organization/client/user/module pattern
- `signed_url_ttl_seconds`
- `upload_audit_required`
- `download_audit_required`
- `retention_rule`

Validation rules:
- Sensitive documents must not use public buckets.
- Signed access must expire quickly and be scoped to an authorized resource.
- File names from users must not be trusted as the internal storage path.

### Webhook Security Record

Purpose: standardize external event ingestion.

Fields:
- `provider`
- `endpoint`
- `verify_jwt`
- `signature_required`
- `secret_name`
- `external_event_id`
- `idempotency_key`
- `payload_retention`
- `processing_status`
- `last_error`
- `attempts`

Validation rules:
- Public webhook endpoints must validate provider signature or verification
  challenge.
- Duplicate events must not repeat irreversible state changes.
- Logs must redact secrets and sensitive payload content.

### Operational Security Setting

Purpose: document environment-level controls not fully represented in code.

Fields:
- `environment`: development, staging, production
- `setting_name`
- `required_value`
- `actual_value_reference`
- `owner`
- `review_frequency`
- `last_verified_at`
- `evidence`

Examples:
- MFA for Supabase dashboard users
- Auth session lifetime
- Inactivity timeout
- Redirect URLs
- Auth rate limits
- Backups/PITR
- deploy headers/CSP
- CORS allowlist
- secret rotation cadence

Validation rules:
- Production must not reuse development secrets.
- Production redirect URLs must be explicit and not broad wildcards.
- Critical access reviews must have an owner and review frequency.

## State Transitions

### Security Control Matrix Item

```text
unknown -> planned -> staged -> validated -> production
unknown -> deferred
planned -> deferred
validated -> remediation_required
production -> remediation_required
remediation_required -> staged
```

Rules:
- High/critical items cannot move to production without validation evidence.
- Items with missing owner cannot move past planned.
- Medium-risk items cannot move past planned without a due date within 60 days.
- Low-risk items cannot move past planned without a due date within 90 days.
- Deferred high/critical items require explicit risk acceptance.

### Webhook Event

```text
received -> verified -> processing -> processed
received -> rejected
processing -> failed -> retrying -> processed
retrying -> failed_permanent
```

Rules:
- Unverified events cannot change operational state.
- Duplicate event IDs must return the previous outcome or no-op safely.

## Indexing And Scale Notes

- Tenant-scoped tables should have indexes starting with `organization_id` for
  common tenant filters.
- Client-scoped operational tables should index `(organization_id, client_id)`
  when both fields exist.
- Audit and webhook logs should index organization, client/provider, action or
  event ID, and created timestamp according to query patterns.
- Private document metadata should support lookup by organization, client,
  bucket/path and created timestamp.
