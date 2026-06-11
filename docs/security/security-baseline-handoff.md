# Security Baseline Handoff

## Completed In This Baseline

- Repository-owned baseline structure under `docs/security/`.
- Inventory scripts under `scripts/security/`.
- Generated control matrix workflow through `npm run security:inventory`.
- Risk classification with critical triggers and review due dates.
- Manual validation scenarios for access, Storage, Edge Functions, audit and operations.

## Open Risks

- Staging validation is blocked until test users, clients, buckets and provider fixtures are available.
- Public webhooks remain critical until signature/idempotency controls are proven.
- Private document Storage remains critical until unauthorized access and signed URL expiry tests pass.
- Browser route protection still needs RLS/Edge Function evidence for sensitive flows.

## Recommended Next Hardening PRs

1. Validate and patch cross-client portal/RLS boundaries.
2. Enforce private Storage policies and document audit coverage.
3. Harden public webhook signature, idempotency and rate-limit controls.
4. Add deploy security headers and CSP in the active hosting configuration.
5. Prove backup/restore and Auth dashboard settings with secure operational evidence.
