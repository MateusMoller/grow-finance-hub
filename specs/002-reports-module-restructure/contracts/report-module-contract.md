# Contract: Report Module User and Data Behaviors

## Scope

This contract defines the expected behavior for the internal Reports module. It is written as an implementation-neutral contract that can be satisfied by React UI, Supabase reads, RPCs or Edge Functions as long as the observable behavior and security requirements hold.

## Actors

- `admin`: full internal access to report governance and sensitive exports within organization.
- `director`: broad operational report access within organization.
- `manager`: operational report access within organization, subject to field restrictions.
- `commercial`: CRM/client report access where permitted, no team/role sensitive export by default.
- Department roles: task/client operational reports only for allowed sectors where applicable.
- `client`: blocked from internal Reports module.

## Dataset Catalog Contract

For each dataset returned to the UI:

```json
{
  "id": "clientes",
  "name": "Clientes",
  "description": "Carteira e dados cadastrais permitidos",
  "classification": "sensitive",
  "previewLimit": 50,
  "exportLimit": 5000,
  "filters": ["organization_id", "company", "competence"],
  "fields": [
    {
      "key": "nome",
      "label": "Nome",
      "dataType": "text",
      "classification": "internal",
      "previewable": true,
      "exportable": true
    }
  ]
}
```

Contract rules:
- Only datasets authorized for the current user and organization are returned.
- Field lists exclude prohibited fields from default selectable options.
- Dataset response must include enough metadata for UI labels, grouping, default columns and validation.
- Unauthorized users receive controlled permission denial, not a partial hidden-data leak.

## Preview Contract

Request shape:

```json
{
  "organizationId": "uuid",
  "datasetId": "clientes",
  "filters": {
    "company": "Empresa Exemplo",
    "competence": "2026-06"
  },
  "columnKeys": ["nome", "status"]
}
```

Response shape:

```json
{
  "datasetId": "clientes",
  "columns": [
    { "key": "nome", "label": "Nome" }
  ],
  "rows": [
    { "nome": "Cliente Exemplo" }
  ],
  "rowCount": 120,
  "previewLimit": 50,
  "warnings": []
}
```

Contract rules:
- Preview applies the same active filters and field authorization that export will use.
- Preview must be bounded by dataset preview limit.
- Preview must identify invalid, deprecated or unauthorized fields in `warnings`.
- Preview must not include prohibited fields.

## Saved Model Contract

Create/update request:

```json
{
  "organizationId": "uuid",
  "name": "Clientes ativos mensal",
  "datasetId": "clientes",
  "columnKeys": ["nome", "status", "email"],
  "format": "xlsx"
}
```

Response:

```json
{
  "id": "uuid",
  "organizationId": "uuid",
  "userId": "uuid",
  "name": "Clientes ativos mensal",
  "datasetId": "clientes",
  "columnKeys": ["nome", "status", "email"],
  "format": "xlsx",
  "invalidColumnKeys": [],
  "createdAt": "2026-06-11T00:00:00Z",
  "updatedAt": "2026-06-11T00:00:00Z"
}
```

Contract rules:
- Models are personal by default.
- Duplicate detection uses normalized name per organization, user and dataset.
- Save/update validates dataset and columns against current catalog and permissions.
- Loading stale models returns diagnostics instead of silently exporting incorrect columns.

## UI State Contract

The module must expose clear states for:
- Initial loading
- Dataset loading
- Dataset partial failure
- Permission denied
- Empty result
- Invalid saved model
- Export blocked by limits
- Export running
- Export completed
- Export failed with controlled reason

The UI must always show:
- Active dataset
- Active filters
- Selected column count
- Export eligibility or reason it is blocked
