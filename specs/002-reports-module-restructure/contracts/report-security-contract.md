# Contract: Report Security, Export and Audit

## Export Authorization Contract

Every sensitive or high-volume export must revalidate:

- Authenticated user id from trusted session/JWT
- Active `organization_id`
- Organization feature flag `relatorios`
- User role within organization
- Dataset permission
- Field-level permission and classification
- Filter validity and tenant/client boundaries
- Row count against allowed volume
- Export format

Failure behavior:
- Permission ambiguity fails closed.
- Invalid dataset or field fails closed.
- Prohibited fields are blocked.
- Volume excess is blocked or routed to a separately approved flow.
- Error messages are controlled and do not expose SQL, stack traces or secrets.

## Export Request Shape

```json
{
  "organizationId": "uuid",
  "datasetId": "clientes",
  "filters": {
    "company": "Empresa Exemplo",
    "competence": "2026-06"
  },
  "columnKeys": ["nome", "status", "email"],
  "format": "xlsx",
  "modelId": "uuid-or-null"
}
```

## Export Result Shape

```json
{
  "status": "completed",
  "fileName": "Clientes-personalizado-2026-06-11.xlsx",
  "rowCount": 120,
  "classification": "sensitive",
  "warnings": []
}
```

Blocked result:

```json
{
  "status": "blocked",
  "reason": "export_limit_exceeded",
  "message": "Reduza os filtros ou solicite fluxo aprovado para exportacao maior.",
  "rowCount": 12000
}
```

## Audit Contract

Sensitive export attempts must record an audit event whether successful, blocked or failed.

Required audit fields:
- `organization_id`
- `actor_user_id`
- `action`
- `entity_type`
- `entity_id`
- `client_id` when applicable
- `result`
- `request_id`
- `metadata.dataset_id`
- `metadata.filters`
- `metadata.column_keys`
- `metadata.row_count`
- `metadata.format`
- `metadata.classification`
- `metadata.failure_code` when applicable

Audit data must not include:
- Full exported rows
- Passwords or senha GOV
- Tokens, API keys or private credentials
- Raw document contents
- Unnecessary personal data beyond identifiers needed for investigation

## Dataset Security Matrix

Initial expected matrix:

| Dataset | Default Classification | Minimum Roles | Backend Export Required |
|---------|------------------------|---------------|-------------------------|
| Clientes | sensitive | admin, director, manager, commercial when approved | yes for sensitive fields or large volume |
| Leads e CRM | internal/sensitive contact data | admin, director, manager, commercial | yes for large volume |
| Tarefas | internal/sensitive operational data | admin, director, manager, allowed department roles | yes for large volume or cross-sector export |
| Equipe | sensitive internal user/role data | admin, director, manager | yes |

## Prohibited Field Rule

Any field whose source name, label or meaning matches password, senha, senha GOV, token, secret, credential, private key, webhook secret, raw document content or equivalent must be classified as prohibited unless a separate security-approved feature changes that status.
