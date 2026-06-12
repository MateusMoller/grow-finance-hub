# report-exports

Backend-owned validation surface for sensitive or high-volume report exports.

## Responsibilities

- Validate authenticated organization context.
- Validate dataset id, format and selected fields.
- Block prohibited fields such as password, senha, token, secret, credential or key.
- Return controlled errors without SQL, stack traces or secrets.
- Record audit metadata when full export generation is enabled.

## Current phase

This function currently validates payload shape and blocks unsafe requests. File generation is intentionally not enabled until dataset-specific authorization and row generation are completed.

## Rollback

If the function fails in production, keep sensitive direct browser export disabled. Do not fallback to unsafe client-side export for sensitive datasets.
