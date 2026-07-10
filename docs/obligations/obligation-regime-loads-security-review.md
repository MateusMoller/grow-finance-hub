# Obligation Regime Loads Security Review

## Review Date

2026-07-10

## Result

Security review passed for the implemented default-obligation flow.

## Checks

- Default application is backend-owned in `grow-obligations-module`; frontend code does not decide default membership.
- User identity is resolved from the authenticated bearer token before any action runs.
- Template management remains limited to the existing manager/director/admin role set.
- System default templates are visible in the catalog, but edit/delete affordances are hidden.
- Backend guards reject edit/delete attempts for non-manual template definitions.
- Client creation calls the obligations module with the current authenticated token and returns controlled warnings instead of failing client creation when default application cannot run.
- Conditional defaults require positive evidence; missing evidence is skipped and auditable.
- Regime-change application inactivates future prior-regime default profiles without deleting completed history.

## Residual Risk

Run an authenticated staging smoke test with a non-manager internal user and a portal user to confirm role and RLS behavior outside unit-level coverage.
