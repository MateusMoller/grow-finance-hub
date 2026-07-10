# Data Model: Default Obligations by Tax Regime

## Existing Entities To Reuse

### `obligation_templates` as Standard Obligation

Represents a reusable obligation definition.

Key attributes:

- `organization_id`
- `code`
- `name`
- `sector`
- `periodicity`
- `competence_reference`
- `technical_due_month_reference`
- `due_day`
- `yearly_due_month`
- `priority`
- `expected_documents`
- `is_active`
- `baseline_source`
- `catalog_review_status`
- `normalized_name`
- `operational_notes`

Validation rules:

- Active standard obligation codes are unique per organization.
- Active names/codes must be duplicate-checked before saving.
- Sector-specific obligations are allowed as manual/catalog items but must not be included in the generic default regime sets for this feature.

### `tax_regime_definitions`

Represents the supported tax regime vocabulary.

Key attributes:

- `organization_id`
- `code`: `mei`, `simples_nacional`, `lucro_presumido`, `lucro_real`
- `label`
- `aliases`
- `is_active`
- `sort_order`

Validation rules:

- Aliases must resolve to only one active regime within an organization.
- Unsupported or missing regimes must block automatic default assignment and produce a user-visible warning.

### `obligation_regime_loads` as Tax Regime Default Set

Represents the governed default set for one tax regime.

Key attributes:

- `organization_id`
- `tax_regime_code`
- `name`
- `status`
- `version`
- `description`
- `owner_sector`
- `review_notes`
- `effective_from`
- `effective_until`

Validation rules:

- Only one active default set per organization and tax regime.
- Only active default sets can be automatically applied.
- Updating a default set must not delete historical company obligations.

### `obligation_regime_load_items` as Default Obligation Membership

Represents an obligation included in a regime default set.

Key attributes:

- `organization_id`
- `load_id`
- `template_id`
- `applicability`: `required`, `optional`, `conditional`
- `condition_key`
- `default_start_policy`
- `default_due_day_override`
- `notes`
- `is_active`
- `sort_order`

Validation rules:

- Active membership is unique per `(organization_id, load_id, template_id)`.
- Conditional items must include a condition key.
- Inactive or sector-specific templates cannot be automatically applied as generic defaults.

## Company Assignment Entities

### `client_obligation_profiles` as Company Obligation Link

Represents an assigned obligation for one company.

Key attributes:

- `organization_id`
- `client_id`
- `template_id`
- `source_kind`: `standard_load`, `manual`, `regime_migration`, `legacy`, `exception`
- `source_load_id`
- `source_load_item_id`
- `applied_regime`
- `application_batch_id`
- `is_active`
- `start_date`
- `end_date`
- `sync_status`: `current`, `skipped`, `not_applicable`
- `conditional_skip_reason`
- due and yearly-month overrides
- expected-document override
- notes

Validation rules:

- Reapplying defaults must reactivate or update the existing company-obligation link rather than create duplicate active links.
- Manual obligations are additive and keep `source_kind = manual`.
- Inactivated company links are not reactivated silently when defaults are reapplied.

### `obligation_load_application_batches`

Represents a default application, manual reapply, or regime migration operation.

Key attributes:

- `organization_id`
- `client_id`
- `tax_regime_code`
- `load_id`
- `mode`: `new_client`, `manual_apply`, `regime_migration`, `reconcile_existing`, `standard_load_sync`
- `sync_scope`
- `status`
- `summary`
- `warnings`
- `created_by`
- `applied_by`
- timestamps

Validation rules:

- Application summaries must include counts for created, kept, reactivated, skipped, blocked, duplicate-risk, and automatically inactivated items.
- Applied batches are immutable audit records.
- Failed batches must preserve controlled error details without exposing secrets or sensitive document content.

### `obligation_load_application_reviews`

Represents item-level application decisions, including conditional skips and duplicate-risk blocks. The existing review-oriented table name may be reused if already present, but missing conditional evidence does not create a user decision requirement.

Key attributes:

- `organization_id`
- `batch_id`
- `client_id`
- `template_id`
- `load_item_id`
- `decision_type`: `add`, `keep`, `reactivate`, `auto_inactivate_prior_regime`, `skip`, `duplicate_risk`, `blocked`
- `current_profile_id`
- `reason`
- `auto_applied`
- `evidence_source`
- `sync_effect`

Validation rules:

- Missing conditional evidence results in `skip` with a clear reason until positive evidence exists.
- Duplicate risk is blocked and must not create a new active link automatically.
- Future active default obligations from the prior regime are inactivated automatically after a supported regime change; completed historical records remain unchanged.

## Conditional Evidence Model

### Evidence Inputs

Generic company attributes used by this feature:

- supported tax regime
- has employees
- provides services
- municipality requires service declaration
- has state registration
- ICMS/IPI taxpayer status
- ICMS/ST, DIFAL, or anticipation exposure
- retentions or service-withholding exposure
- ECD applicability
- EFD-Contribuições applicability
- tax benefit or incentive usage

Validation rules:

- Evidence must be scoped to the same organization and company.
- Unknown evidence skips the affected conditional obligation until positive evidence is later recorded.

## Manual Obligation Model

### Manual Obligation

A user-created obligation definition or company-specific link outside the governed default set.

Key attributes:

- master obligation metadata from `obligation_templates`
- selected company links via `client_obligation_profiles`
- source kind `manual`
- audit metadata

Validation rules:

- Manual obligations must pass duplicate checks against active standard obligations.
- Manual links must not update default set membership for other companies.
- Manual obligations can later be included in a default set only through controlled technical maintenance.

## State Transitions

### Company Obligation Link

```text
not_assigned -> active_standard
not_assigned -> active_manual
active_standard -> inactive_exception
active_standard -> active_regime_migration
active_manual -> inactive_exception
skipped -> active_standard
```

### Default Application Batch

```text
initialized -> applied
initialized -> failed
applied -> terminal
failed -> terminal
```

### Regime Change

```text
old_regime_current -> automatic_regime_migration_applied
```

Historical completed obligations remain outside destructive state transitions.

## Baseline Generic Matrix

### MEI

- PGMEI/DAS MEI
- DASN-SIMEI
- eSocial if employees
- FGTS if employees
- DCTFWeb/MIT if employees or retentions
- ISS municipal if service provider
- municipal service declaration if municipality requires
- NFS-e/emission fiscal municipal if service provider
- gross revenue control
- limit/disqualification review
- DeSTDA if state registration or state requires

### Simples Nacional

- PGDAS-D
- DEFIS
- DCTFWeb/MIT if employees or retentions
- eSocial if employees
- FGTS if employees
- EFD-Reinf if retentions or services
- ISS municipal if service provider
- municipal service declaration if municipality requires
- NFS-e/emission fiscal municipal if service provider
- EFD ICMS/IPI if ICMS/IPI taxpayer
- DeSTDA if ICMS/ST, DIFAL, or anticipation applies
- DAS complementary review when applicable
- annual Simples option review
- generic state obligations by UF
- generic municipal obligations by municipality

### Lucro Presumido

- DCTFWeb/MIT
- EFD-Reinf
- eSocial if employees
- FGTS if employees
- EFD-Contribuições when applicable
- EFD ICMS/IPI if ICMS/IPI taxpayer
- ISS municipal if service provider
- municipal service declaration if municipality requires
- ECD when applicable
- ECF
- IRPJ/CSLL quarterly
- PIS/COFINS cumulative
- DIRBI if tax benefits or incentives are used
- generic state obligations by UF
- generic municipal obligations by municipality

### Lucro Real

- DCTFWeb/MIT
- EFD-Reinf
- eSocial if employees
- FGTS if employees
- EFD-Contribuições
- EFD ICMS/IPI if ICMS/IPI taxpayer
- ISS municipal if service provider
- municipal service declaration if municipality requires
- ECD
- ECF
- IRPJ/CSLL Lucro Real
- PIS/COFINS non-cumulative
- DIRBI if tax benefits or incentives are used
- generic state obligations by UF
- generic municipal obligations by municipality

## Indexing and Query Strategy

- Regime load lookup by organization, regime code, and active status.
- Load item lookup by load and active status.
- Client profile lookup by organization, client, and template.
- Duplicate detection by organization, normalized code, and normalized name.
- Application batch and review lookup by organization, client, and created date.

## Rollback Strategy

- Disable automatic application for new registrations by turning off the active default set or feature flag.
- Revert default-load memberships by inactivating/removing the latest seeded generic memberships.
- Preserve already-created company obligation links and generated history unless a separate controlled cleanup is approved.
