# Data Model: Reestruturacao Profissional do Modulo de Relatorios

## Report Dataset

Represents a governed reporting base available to internal users.

Fields:
- `id`: stable dataset identifier, e.g. `clientes`, `leads_crm`, `tarefas`, `equipe`
- `name`: user-facing name
- `description`: purpose and expected use
- `source_owner`: business owner for correctness of the data
- `source_tables_or_views`: documented source of truth
- `default_filters`: filters applied by default
- `required_filters`: filters required before preview/export
- `default_sort`: stable sort for preview/export
- `preview_limit`: maximum rows rendered in UI preview
- `export_limit`: maximum rows for direct export
- `minimum_roles`: roles allowed to see the dataset
- `blocked_roles`: roles explicitly blocked
- `classification`: highest classification among included fields
- `enabled`: whether dataset is available

Validation rules:
- Dataset ids are stable and must not be reused for different meanings.
- Every dataset must declare at least one owner, one source and one permission rule.
- Internal datasets must block `client` role.
- Dataset cannot be enabled if any selectable field is unclassified.

Relationships:
- Has many Report Fields.
- Has many Saved Report Models.
- Produces Report Previews and Report Exports.

## Report Field

Represents a selectable or governed field in a dataset.

Fields:
- `key`: stable field identifier within dataset
- `label`: user-facing column label
- `description`: meaning and business caveat
- `source_path`: source table/view/derived rule
- `data_type`: text, number, date, datetime, currency, percent, boolean, enum
- `classification`: internal, sensitive, regulated or prohibited
- `minimum_roles`: optional stricter roles for this field
- `formatter`: approved display/export formatting behavior
- `default_selected`: whether included in default columns
- `exportable`: whether field can be exported
- `previewable`: whether field can appear in preview
- `deprecated`: whether the field remains only for saved model compatibility

Validation rules:
- Field keys must be unique per dataset.
- Prohibited fields are not previewable or exportable.
- Fields with credential-like names must default to prohibited until explicitly classified otherwise.
- Field labels must be legible and must not expose internal database naming as the primary label.

Relationships:
- Belongs to one Report Dataset.
- May be referenced by many Saved Report Models.
- Appears in Report Export metadata by key, not full cell contents.

## Report Filter

Represents a user-visible and/or system-enforced scope for preview and export.

Fields:
- `organization_id`: active organization scope
- `company`: optional global company filter
- `client_id`: optional client scope when supported
- `competence`: optional competence/month scope
- `period`: optional report period
- `status`: optional status filter
- `sector`: optional department/sector filter
- `assignee`: optional responsible user filter

Validation rules:
- `organization_id` is required for internal report reads and exports.
- Client-specific datasets must enforce client authorization if `client_id` is used.
- Unsupported filters must be ignored only if explicitly documented; otherwise they should produce controlled validation errors.

Relationships:
- Applied to Report Preview and Report Export.
- Captured in audit metadata without storing sensitive row content.

## Saved Report Model

Represents a personal reusable report configuration.

Fields:
- `id`: unique model id
- `organization_id`: tenant owner scope
- `user_id`: model owner
- `name`: user-facing model name
- `normalized_name`: normalized form for duplicate detection
- `dataset_id`: selected dataset
- `column_keys`: ordered list of selected field keys
- `format`: first release uses `xlsx`
- `auto_generate`: retained compatibility flag; no automatic generation until separately specified
- `created_at`: creation timestamp
- `updated_at`: last update timestamp

Validation rules:
- User can read/update/delete only own model unless shared models are specified later.
- `(organization_id, user_id, normalized_name, dataset_id)` must be unique.
- `column_keys` must be non-empty and valid for the dataset at save time.
- Loading a stale model must return valid columns and invalid column diagnostics.
- Model save/update must respect current dataset and field authorization.

Relationships:
- Belongs to one user and organization.
- References one Report Dataset.
- References many Report Fields by key.

State transitions:
- `draft in UI` -> `saved`
- `saved` -> `loaded`
- `saved` -> `editing`
- `editing` -> `updated`
- `saved|editing` -> `deleted`
- `saved` -> `stale` when dataset/fields no longer validate

## Report Preview

Represents a bounded sample shown before export.

Fields:
- `dataset_id`
- `organization_id`
- `filters`
- `column_keys`
- `rows`: bounded row sample
- `row_count`: total or bounded count behavior
- `warnings`: invalid columns, partial data, deprecated fields, filter caveats
- `generated_at`

Validation rules:
- Uses same authorization and filters as export eligibility.
- Must not include prohibited fields.
- Must not exceed dataset preview limit.

Relationships:
- Created from Report Dataset, Report Fields and Report Filters.
- Does not persist row contents by default.

## Report Export

Represents a generation request and result for a spreadsheet.

Fields:
- `id`: export request id when backend-owned
- `organization_id`
- `user_id`
- `dataset_id`
- `filters`
- `column_keys`
- `format`: `xlsx`
- `classification`
- `row_count`
- `status`: requested, running, completed, blocked, failed
- `failure_code`: controlled reason when failed
- `file_name`
- `created_at`
- `completed_at`

Validation rules:
- Authorization is rechecked at generation time.
- Export cannot run with zero columns or prohibited fields.
- Export cannot run above direct limit unless approved route exists.
- Sensitive exports must create audit event whether completed, blocked or failed.

Relationships:
- Uses Report Dataset, Fields and Filters.
- Emits Report Audit Event.

State transitions:
- `requested` -> `running`
- `running` -> `completed`
- `requested|running` -> `blocked`
- `requested|running` -> `failed`

## Report Audit Event

Represents auditable evidence for sensitive report activity.

Fields:
- `organization_id`
- `actor_user_id`
- `action`: report_preview, report_export, report_model_create, report_model_update, report_model_delete
- `dataset_id`
- `entity_id`: saved model id or export request id when applicable
- `client_id`: optional when scoped to a client
- `result`: success, warning, error
- `metadata`: filters, selected field keys, row count, format, classification, failure code
- `request_id`
- `created_at`

Validation rules:
- Must not store full exported content.
- Must not store secrets, tokens, passwords or raw document content.
- Must include enough metadata to reconstruct who acted, scope, dataset and result.

## Data Classification Rule

Represents policy for whether a field can be shown or exported.

Fields:
- `classification`: internal, sensitive, regulated, prohibited
- `default_previewable`
- `default_exportable`
- `required_roles`
- `requires_audit`
- `requires_backend_export`
- `volume_limit`

Validation rules:
- Prohibited always means no direct preview/export.
- Sensitive and regulated exports require audit.
- Regulated/high-risk fields require backend-owned export path.

## Organization Feature Flag

Represents organization-level availability of the reports module.

Fields:
- `organization_id`
- `relatorios_enabled`
- `updated_at`

Validation rules:
- Disabled feature hides module access and blocks generation.
- Existing saved models are preserved while disabled.
