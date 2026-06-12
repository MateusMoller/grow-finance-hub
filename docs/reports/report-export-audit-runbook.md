# Report Export Audit Runbook

## Events

Sensitive report exports must record or return enough context to audit:
- actor user id
- organization id
- dataset id
- selected field keys
- active filters
- row count
- format
- classification
- result or failure code

## Investigation checklist

1. Confirm the user had an internal role for the organization.
2. Confirm the dataset and selected fields were allowed by catalog policy.
3. Confirm no prohibited field such as senha, password, token, secret or credential was exported.
4. Confirm row count was within approved limits or routed to backend validation.
5. Confirm the failure message shown to the user did not expose SQL, stack traces or secrets.

## Current implementation note

The first backend function validates and blocks unsafe/sensitive export paths until full backend file generation is enabled. Direct XLSX generation remains limited to policy-approved low-risk paths.
