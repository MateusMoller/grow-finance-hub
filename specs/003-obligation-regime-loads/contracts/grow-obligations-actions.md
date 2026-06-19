# Contract: `grow-obligations-module` Actions

All actions use the existing Supabase Edge Function invocation pattern:

```ts
invokeGrowObligations({ action: "...", ...payload })
```

The backend must resolve authenticated user, organization, roles and feature flags before executing any action.

## `list_regime_loads`

Purpose: load catalog management data for the internal obligation workspace.

Request:

```json
{
  "action": "list_regime_loads",
  "organization_id": "uuid",
  "tax_regime_code": "simples_nacional",
  "status": "active"
}
```

Response:

```json
{
  "ok": true,
  "regimes": [],
  "loads": [],
  "items": [],
  "templates": [],
  "duplicate_warnings": []
}
```

Rules:

- Internal authenticated users only.
- Results scoped to requested/active organization.
- `templates` may be filtered to active catalog plus templates referenced by returned loads.

## `upsert_regime_load`

Purpose: create or update one load header.

Request:

```json
{
  "action": "upsert_regime_load",
  "id": "uuid-or-null",
  "organization_id": "uuid",
  "tax_regime_code": "lucro_presumido",
  "name": "Lucro Presumido - Carga Padrao",
  "status": "in_review",
  "description": "Baseline fiscal, contábil e folha",
  "owner_sector": "Fiscal",
  "review_notes": "Revisado pela equipe fiscal",
  "effective_from": "2026-06-01",
  "effective_until": null
}
```

Response:

```json
{
  "ok": true,
  "load": {}
}
```

Rules:

- Roles: `admin`, `director`, `manager`.
- Only one active load per organization/regime.
- Activation must fail if active items reference inactive or duplicate-risk templates.
- Publishing changes to an active load must enqueue or execute synchronization for existing clients of the same regime, limited to active/future client-obligation links.

## `upsert_regime_load_item`

Purpose: add or update the membership of a master obligation in a load.

Request:

```json
{
  "action": "upsert_regime_load_item",
  "id": "uuid-or-null",
  "organization_id": "uuid",
  "load_id": "uuid",
  "template_id": "uuid",
  "applicability": "conditional",
  "condition_key": "has_employees",
  "default_start_policy": "current_month",
  "default_due_day_override": null,
  "notes": "Aplicavel quando houver empregado",
  "is_active": true,
  "sort_order": 30
}
```

Response:

```json
{
  "ok": true,
  "item": {},
  "warnings": []
}
```

Rules:

- Roles: `admin`, `director`, `manager`.
- Same `template_id` cannot be active twice in same load.
- Conditional items require `condition_key`.

## `preview_apply_regime_load`

Purpose: preview applying or reapplying a load to an existing client.

Request:

```json
{
  "action": "preview_apply_regime_load",
  "organization_id": "uuid",
  "client_id": "uuid",
  "tax_regime_code": "lucro_real",
  "mode": "regime_migration"
}
```

Response:

```json
{
  "ok": true,
  "batch": {
    "id": "uuid",
    "status": "previewed",
    "summary": {
      "add": 12,
      "keep": 20,
      "reactivate": 1,
      "suggest_inactivate": 3,
      "duplicate_risk": 0,
      "blocked": 0
    }
  },
  "reviews": [
    {
      "template_id": "uuid",
      "decision_type": "add",
      "requires_confirmation": false,
      "selected": true,
      "reason": "Obrigacao presente na carga ativa do regime"
    }
  ],
  "warnings": []
}
```

Rules:

- Internal authenticated users only.
- Client must belong to organization.
- Does not change client profiles.
- Missing active load returns controlled `blocked` response.

## `apply_regime_load`

Purpose: apply selected preview decisions or automatic new-client load.

Request:

```json
{
  "action": "apply_regime_load",
  "organization_id": "uuid",
  "client_id": "uuid",
  "tax_regime_code": "simples_nacional",
  "mode": "new_client",
  "batch_id": "uuid-or-null",
  "confirmed_review_ids": ["uuid"],
  "auto_generate_instances": false
}
```

Response:

```json
{
  "ok": true,
  "batch": {
    "id": "uuid",
    "status": "applied",
    "summary": {
      "created": 18,
      "kept": 4,
      "reactivated": 0,
      "inactivated": 0,
      "skipped": 2
    }
  },
  "profiles": []
}
```

Rules:

- Backend re-runs all authorization and duplicate checks before writing.
- New-client mode can run without a prior `batch_id` only when no destructive or confirmation-required action exists.
- New-client mode creates client-obligation links only; it must not generate competencies, tasks or calendar events.
- Conditional items are applied only when client data provides sufficient evidence; otherwise they are returned as review warnings.
- Existing-client mode requires a preview batch.
- Must not delete historical profiles or instances.

## `sync_regime_load_existing_clients`

Purpose: synchronize a published active load change to existing clients of the same tax regime.

Request:

```json
{
  "action": "sync_regime_load_existing_clients",
  "organization_id": "uuid",
  "load_id": "uuid",
  "tax_regime_code": "simples_nacional",
  "mode": "published_load_change"
}
```

Response:

```json
{
  "ok": true,
  "sync_run": {
    "id": "uuid",
    "status": "completed_with_warnings",
    "summary": {
      "clients_processed": 120,
      "profiles_created": 40,
      "profiles_reactivated": 3,
      "profiles_inactivated_future": 6,
      "profiles_skipped": 12,
      "review_required": 8
    }
  },
  "warnings": []
}
```

Rules:

- Roles: `admin`, `director`, `manager`, or backend-owned automatic execution after publish.
- Must process only clients in the same organization and same normalized tax regime.
- Must update only active/future client-obligation links.
- Must not update already generated competencies, tasks, calendar events, documents or protocols.
- Branches with inherited parent regime must be placed in review instead of blindly synchronized.

## `detect_obligation_duplicates`

Purpose: provide duplicate diagnostics for catalog management.

Request:

```json
{
  "action": "detect_obligation_duplicates",
  "organization_id": "uuid",
  "name": "F.G.T.S.",
  "code": "fgts"
}
```

Response:

```json
{
  "ok": true,
  "matches": [
    {
      "template_id": "uuid",
      "code": "fgts",
      "name": "FGTS",
      "match_type": "code",
      "severity": "block"
    }
  ]
}
```

Rules:

- Called by UI before save for helpful feedback.
- `upsert_template` must still enforce the same rule server-side.
