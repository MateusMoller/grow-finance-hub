# Security Baseline

`docs/security/` is the first source of truth for the Grow Finance Hub security baseline. It records protected surfaces, risk classification, validation evidence, blocked checks and required hardening follow-ups.

This first baseline is intentionally repository-owned and reviewable in Git. It does not create new database tables or an admin UI. Runtime changes should be opened from the risks and remediation rows documented here.

## Scope

- Supabase RLS and table access boundaries.
- Supabase Auth settings and privileged user flows.
- Supabase Storage buckets, signed URLs and upload validation.
- Edge Functions, public webhooks, service-role usage and secrets.
- Frontend route protection and deploy headers.
- Audit evidence, incident response, backups and access review.

## Baseline Workflow

1. Run `npm run security:inventory`.
2. Review `docs/security/security-control-matrix.md`.
3. Validate manual scenarios in staging.
4. Record results in `docs/security/security-validation-runbook.md`.
5. Open hardening tasks for every critical/high gap.

Sensitive controls are complete only when the backend, database or deploy platform enforces them. UI-only restrictions are usability hints, not security evidence.
