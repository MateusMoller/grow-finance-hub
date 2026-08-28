# Contract: DCTFWeb task workflow

## Task context

`get_task_dctfweb_context(taskId)` returns eligibility, normalized client/competence/category, dossier state, prerequisite checklist and available actions. It returns no provider XML or secret.

## Actions

- `consult_dctfweb_xml(dossierId)` -> normalized declaration metadata and artifact availability.
- `consult_dctfweb_receipt(dossierId, receiptNumber)` -> receipt metadata/artifact.
- `consult_dctfweb_report(dossierId, receiptNumber)` -> complete-report artifact.
- `generate_dctfweb_darf(dossierId, mode, receiptNumber?, idempotencyKey)` -> DARF artifact and provider state.
- `approve_dctfweb_dossier(dossierId, expectedVersion)` -> approved immutable version.
- `transmit_dctfweb(dossierId, expectedVersion, confirmationToken)` -> controlled submission result; unavailable until production gates pass.

All actions require authenticated internal access, active organization match, task/client/instance ownership and server-side input validation. Errors use stable business codes; raw provider messages are sanitized.
