# Security Risk Classification

## Critical

Must be handled immediately and validated before production acceptance.

Critical triggers:

- Possible cross-tenant, cross-organization or cross-client data exposure.
- Service-role or secret-backed operation without strong authorization and payload validation.
- Private Storage object accessible without authorization.
- Public webhook that mutates state without signature, idempotency or equivalent provider validation.

Target due date: 30 days or less from discovery, with emergency handling for confirmed exposure.

## High

Material exposure or privilege risk that requires near-term remediation.

Examples: incomplete role enforcement, privileged Edge Function with unclear organization checks, sensitive report access without documented RLS evidence, AI action without confirmation or audit proof.

Target due date: 30 days or less.

## Medium

Control gap with bounded impact or incomplete evidence.

Examples: missing review proof, unclear rate limit, incomplete audit field coverage, route where frontend enforcement needs backend confirmation.

Target due date: 60 days or less.

## Low

Documentation, operational hygiene or low-impact hardening item.

Examples: public route inventory review, policy wording updates, non-sensitive logging improvement.

Target due date: 90 days or less.
