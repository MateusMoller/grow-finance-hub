# Reports Security Review

## Controls added

- Credential-like field detection for password, senha, token, secret, credential and key.
- Prohibited fields are excluded from preview/export.
- Sensitive and regulated exports are routed to backend validation.
- Saved model mutations emit operational audit metadata through the shared audit helper.
- Export audit metadata stores filters, field keys and counts, not full row contents.

## Reviewed risks

- Cross-role exposure: dataset and field permission helpers block unauthorized roles.
- Cross-tenant exposure: report hooks require active organization and migration hardens saved models.
- Secret export: prohibited fields are blocked by catalog validation and export policy.
- Unsafe fallback: sensitive exports do not fallback to browser XLSX when backend validation blocks.

## Residual risk

- Edge Function currently validates and blocks sensitive export paths; full backend file generation and audit insertion should be completed before enabling high-volume sensitive downloads.
