# Contract: Default Obligation Actions

This contract defines the backend-owned actions needed for default obligations by tax regime. Names are descriptive; implementation may map them to existing module actions where behavior already exists.

## Action: Apply Defaults During Company Registration

### Caller

Internal company registration flow after a company is successfully created with a supported tax regime.

### Required Authorization

- Authenticated internal user.
- User must belong to the active organization.
- User must be authorized to create or manage the target company.
- Target company must belong to the same active organization.

### Input

```json
{
  "action": "apply_default_obligations",
  "client_id": "uuid",
  "tax_regime_code": "mei | simples_nacional | lucro_presumido | lucro_real",
  "mode": "new_client",
  "evidence": {
    "has_employees": true,
    "service_provider": true,
    "municipal_service_declaration_required": true,
    "state_registration": true,
    "icms_ipi_taxpayer": true,
    "icms_st_difal_anticipation": false,
    "retentions_or_services": true,
    "ecd_applicable": true,
    "efd_contribuicoes_applicable": true,
    "tax_benefit_or_incentive_usage": false
  }
}
```

Evidence fields may be omitted when unknown. Unknown required evidence skips the affected conditional obligation until positive evidence is later recorded.

### Output

```json
{
  "ok": true,
  "batch_id": "uuid",
  "summary": {
    "created": 8,
    "kept": 0,
    "reactivated": 0,
    "skipped": 3,
    "blocked": 0,
    "duplicate_risk": 0,
    "conditional_skipped": 2
  },
  "warnings": [],
  "profiles": [
    {
      "client_id": "uuid",
      "template_id": "uuid",
      "source_kind": "standard_load",
      "applied_regime": "simples_nacional",
      "sync_status": "current"
    }
  ],
  "skipped_items": [
    {
      "template_id": "uuid",
      "decision_type": "skip",
      "reason": "Missing municipal requirement evidence.",
      "auto_apply_when_positive_evidence_exists": true
    }
  ]
}
```

### Failure Modes

- Unsupported or missing regime: no profiles created, controlled warning returned.
- No active default set for regime: no profiles created, controlled warning returned.
- Duplicate active profile risk: conflicting item is blocked and returned with a controlled duplicate-risk warning.
- Unauthorized actor or organization mismatch: request rejected.

## Action: Apply Regime Change Defaults

### Caller

Internal client detail flow when a company's tax regime changes.

### Input

```json
{
  "action": "apply_regime_change_default_obligations",
  "client_id": "uuid",
  "from_tax_regime_code": "simples_nacional",
  "to_tax_regime_code": "lucro_presumido",
  "evidence": {}
}
```

### Output

```json
{
  "ok": true,
  "batch_id": "uuid",
  "summary": {
    "add": 6,
    "keep": 4,
    "inactivated_prior_regime": 2,
    "duplicate_risk": 0,
    "blocked": 1,
    "conditional_skipped": 1
  },
  "decisions": [
    {
      "template_id": "uuid",
      "decision_type": "keep",
      "reason": "Shared obligation already active."
    },
    {
      "template_id": "uuid",
      "decision_type": "inactivate_prior_regime",
      "reason": "Default belongs only to previous regime."
    }
  ]
}
```

### Expected Behavior

- Automatically inactivates future active default obligations from the prior regime.
- Automatically applies applicable future default obligations from the new regime.
- Keeps historical completed obligations unchanged.
- Does not create duplicate active profiles.
- Skips conditional obligations that lack positive evidence.

## Action: Apply Conditional Defaults After Evidence Update

### Caller

Internal company update flow after relevant obligation evidence fields change.

### Input

```json
{
  "action": "apply_conditional_default_obligations_after_evidence_update",
  "client_id": "uuid",
  "changed_evidence_keys": ["has_employees", "service_provider"]
}
```

### Expected Behavior

- Evaluates only conditional default obligations affected by changed evidence.
- Automatically applies newly applicable future obligations when positive evidence exists.
- Does not create duplicate active profiles.
- Leaves still-unknown conditionals skipped.

## Action: Create Manual Obligation

### Caller

Internal manual obligation flow or client obligation panel.

### Input

```json
{
  "action": "upsert_manual_obligation",
  "template": {
    "name": "Custom obligation",
    "sector": "Fiscal",
    "periodicity": "monthly",
    "due_day": 20
  },
  "linked_client_ids": ["uuid"]
}
```

### Expected Behavior

- Performs duplicate detection against active standard and manual obligations.
- Creates or updates a manual obligation definition when allowed.
- Links only selected companies.
- Uses `source_kind = manual` for company links.
- Does not mutate any default regime set membership.
