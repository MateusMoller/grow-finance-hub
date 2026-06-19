# Data Model: Cargas Padrao de Obrigacoes por Regime Tributario

## Existing Entities To Reuse

### `obligation_templates` as Master Obligation

Canonical obligation definition.

Relevant existing fields:

- `id`
- `organization_id`
- `code`
- `name`
- `sector`
- `periodicity`
- `competence_reference`
- `technical_due_month_reference`
- `due_day`
- `yearly_due_month`
- `legal_due_day`
- `priority`
- `expected_documents`
- `is_active`
- `generates_calendar`
- `generates_kanban`
- `requires_document`
- `operational_notes`
- communication defaults

Planned additions:

- `normalized_name`: generated/stored duplicate key for names.
- `duplicate_group_key`: optional review grouping for semantic duplicates.
- `baseline_source`: `manual`, `seed`, `migration`, `legacy_import`.
- `catalog_review_status`: `approved`, `needs_review`, `duplicate_candidate`, `inactive`.

Validation:

- `code` remains unique per organization.
- `normalized_name` should be unique or at minimum conflict-detected per organization for active templates.
- Inactive templates cannot be added to active loads unless explicitly retained for historical review.

### `client_obligation_profiles` as Company/Client Obligation Link

Client-specific assignment of a master obligation.

Relevant existing fields:

- `id`
- `organization_id`
- `client_id`
- `template_id`
- `assigned_to`
- `start_date`
- `end_date`
- `is_active`
- due overrides
- `expected_documents_override`
- `notes`
- `parameters`

Planned additions:

- `source_kind`: `standard_load`, `manual`, `regime_migration`, `legacy`, `exception`.
- `source_load_id`: nullable reference to regime load when created by load.
- `source_load_item_id`: nullable reference to load item.
- `applied_regime`: normalized regime at time of application.
- `application_batch_id`: groups links created/updated in the same load application.
- `inactivation_reason`: controlled reason when deactivated by migration or user.
- `sync_status`: `current`, `pending_review`, `skipped`, `not_applicable`.
- `conditional_review_reason`: nullable reason when a conditional item was not applied automatically.

Validation:

- One active or historical profile per `(organization_id, client_id, template_id)` according to existing uniqueness. Reapplication should reactivate/update existing rows instead of inserting duplicates.
- End date must be after start date.
- Overrides affect only the client profile, never the master obligation or load.
- Synchronization from load changes can update active/future profile links but must not mutate generated instances.

### `obligation_instances`

Generated monthly/periodic operational records.

No new primary model required. Must preserve existing records when profiles are inactivated or regime changes.

Validation:

- Existing unique `(client_id, template_id, competence_key)` prevents duplicate competencies.
- Inactivated profiles should stop future generation, not delete history.

## New Entities

### `tax_regime_definitions`

Supported regime vocabulary and normalization.

Fields:

- `id`
- `organization_id`
- `code`: `simples_nacional`, `lucro_presumido`, `lucro_real`, `mei`
- `label`
- `aliases`
- `is_active`
- `sort_order`
- `created_at`
- `updated_at`

Relationships:

- One tax regime has many regime obligation loads.
- Client `regime` text maps to a regime definition by code/alias.

Validation:

- Unique `(organization_id, code)`.
- Aliases must not collide across active regimes in the same organization.

### `obligation_regime_loads`

Governed load for a regime.

Fields:

- `id`
- `organization_id`
- `tax_regime_code`
- `name`
- `status`: `active`, `inactive`, `in_review`
- `version`
- `description`
- `owner_sector`
- `review_notes`
- `effective_from`
- `effective_until`
- `created_by`
- `updated_by`
- `created_at`
- `updated_at`

Relationships:

- One load belongs to one organization and one tax regime.
- One active load per `(organization_id, tax_regime_code)` should be allowed at a time.
- One load has many load items.

Validation:

- Only one active load per regime and organization.
- `effective_until` must be null or after `effective_from`.
- Loads in `inactive` or `in_review` status are not applied automatically.

### `obligation_regime_load_items`

Relationship between a load and a master obligation.

Fields:

- `id`
- `organization_id`
- `load_id`
- `template_id`
- `applicability`: `required`, `optional`, `conditional`
- `condition_key`: nullable controlled key such as `has_employees`, `iss_applicable`, `icms_taxpayer`, `service_provider`, `accounting_contracted`.
- `default_start_policy`: `client_created_at`, `current_month`, `next_month`, `custom`.
- `default_due_day_override`
- `notes`
- `is_active`
- `sort_order`
- `created_by`
- `updated_by`
- `created_at`
- `updated_at`

Relationships:

- Belongs to one load and one master obligation.
- Can become the source of many client obligation profiles.

Validation:

- Unique active `(organization_id, load_id, template_id)`.
- `template_id` must point to an active master obligation for automatic application.
- Conditional items must include `condition_key`.

### `obligation_load_application_batches`

Audit and grouping record for applying/reapplying loads.

Fields:

- `id`
- `organization_id`
- `client_id`
- `tax_regime_code`
- `load_id`
- `mode`: `new_client`, `manual_apply`, `regime_migration`, `reconcile_existing`, `standard_load_sync`
- `sync_scope`: `single_client`, `existing_clients_same_regime`, `branch_inherited_regime`
- `status`: `previewed`, `applied`, `failed`, `cancelled`
- `summary`: counts for add, keep, reactivate, inactivate_suggested, duplicate_risk, skipped
- `warnings`
- `created_by`
- `applied_by`
- `created_at`
- `applied_at`

Relationships:

- One batch can create/update many client obligation profiles.
- A batch belongs to one client and one organization.
- Batch mode `standard_load_sync` may cover many clients of the same organization/regime through bounded processing.

Validation:

- `applied` requires an actor and immutable summary.
- Failed batches preserve error summary but do not partially hide successful row-level outcomes.
- Synchronization batches must record that generated competencies/tasks/calendar/documents/protocols were not modified.

### `obligation_load_application_reviews`

Preview result for existing clients/regime changes.

Fields:

- `id`
- `organization_id`
- `batch_id`
- `client_id`
- `template_id`
- `load_item_id`
- `decision_type`: `add`, `keep`, `reactivate`, `suggest_inactivate`, `skip`, `duplicate_risk`, `blocked`
- `current_profile_id`
- `reason`
- `requires_confirmation`
- `selected`
- `evidence_source`: nullable key describing why a conditional item was applied or sent to review.
- `sync_effect`: `profile_only`, `future_only`, `no_change`, `blocked`.
- `created_at`

Validation:

- `suggest_inactivate` and `duplicate_risk` require explicit confirmation before applying.
- `blocked` items cannot be applied until the cause is resolved.
- Conditional items without sufficient evidence must use `decision_type = blocked` or `skip` with a review reason instead of creating an active profile automatically.

### `obligation_load_sync_runs`

Operational record for automatic synchronization after a published active load change.

Fields:

- `id`
- `organization_id`
- `load_id`
- `tax_regime_code`
- `status`: `queued`, `processing`, `completed`, `completed_with_warnings`, `failed`, `cancelled`
- `scope`: `existing_clients_same_regime`
- `clients_total`
- `clients_processed`
- `profiles_created`
- `profiles_reactivated`
- `profiles_inactivated_future`
- `profiles_skipped`
- `review_required`
- `warnings`
- `started_by`
- `started_at`
- `completed_at`

Validation:

- Sync runs must be idempotent for the same published load version.
- Sync runs must not update `obligation_instances`, generated tasks, calendar events, documents or protocols.
- Failures must leave enough progress metadata for retry or investigation.

### `obligation_audit_events`

If no existing audit table is suitable, add a narrow audit table for obligation catalog/load events.

Fields:

- `id`
- `organization_id`
- `client_id`
- `entity_type`: `template`, `regime_load`, `load_item`, `client_profile`, `application_batch`
- `entity_id`
- `action`
- `actor_id`
- `metadata`
- `created_at`

Validation:

- Metadata must not include document contents, secrets or unnecessary sensitive payloads.
- Must include before/after summary for mutable catalog and load changes.

## State Transitions

### Load Status

```text
in_review -> active
active -> inactive
inactive -> in_review
```

Only active loads can be applied automatically.

### Application Batch Status

```text
previewed -> applied
previewed -> cancelled
previewed -> failed
queued -> processing
processing -> completed
processing -> completed_with_warnings
processing -> failed
applied -> [terminal]
cancelled -> [terminal]
failed -> [terminal]
```

New-client automatic application may create and apply a batch in one backend action if there are no blocking warnings, but it must create links only and never competencies/tasks/calendar events.
Published active-load changes create a synchronization run that updates only active/future client profile links for clients in the same regime.

### Client Profile Source

```text
standard_load -> exception
standard_load -> regime_migration
manual -> exception
legacy -> standard_load
```

Source records why a client has a profile. It does not replace audit events.

## Baseline Seed Strategy

- Seed master obligations idempotently by stable `code`, not display name.
- Seed regime definitions idempotently by `code`.
- Seed active baseline loads per organization.
- Seed load items by `(load_id, template_id)`.
- Shared obligations such as FGTS, eSocial and DCTFWeb/MIT are seeded once as master obligations and linked to multiple loads.
- Seed conditional items with condition keys so automatic application can distinguish apply, skip and review decisions.

## Indexing Strategy

- `obligation_templates (organization_id, code)`
- `obligation_templates (organization_id, normalized_name)`
- `obligation_regime_loads (organization_id, tax_regime_code, status)`
- `obligation_regime_load_items (organization_id, load_id, template_id)`
- `client_obligation_profiles (organization_id, client_id, template_id)`
- `obligation_load_application_batches (organization_id, client_id, created_at desc)`
- `obligation_load_sync_runs (organization_id, load_id, status, started_at desc)`
- `obligation_audit_events (organization_id, entity_type, entity_id, created_at desc)`

## RLS Strategy

- Regime definitions and loads: internal users can read; managers/admin/directors can manage.
- Load application batches/reviews: internal users can read within organization; only backend or privileged roles can write.
- Sync runs: internal users can read within organization; writes are backend-owned.
- Client profiles keep organization/client scoping; portal users only see resulting instances/files through existing portal-authorized policies, not load management records.
