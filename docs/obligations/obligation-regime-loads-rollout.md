# Obligation Regime Loads Rollout

## Rollout

1. Apply `supabase/migrations/20260710103000_default_obligation_regime_matrix.sql`.
2. Validate that each tenant has one active default load per tax regime: MEI, Simples Nacional, Lucro Presumido and Lucro Real.
3. Validate that the system matrix contains only generic obligations. Sector-specific obligations such as DMED, DIMOB, DOI, e-Financeira, CNO and SERO are intentionally excluded.
4. Enable backend actions for internal users through `grow-obligations-module`.
5. Enable UI entry points for manual add-ons only. System default definitions must stay visible but not editable or deletable in the catalog UI.
6. Monitor application batches, skipped conditional decisions and audit events after release.

## Default Application Behavior

- New company creation calls `apply_default_obligations` after the client record is created.
- Required default obligations are linked to the client as `source_kind = standard_load`.
- Conditional defaults are applied only when positive evidence exists. Missing evidence is recorded as skipped and may be re-evaluated later.
- Default application does not create competencies, tasks, calendar events, documents or protocols.
- Manual obligations remain available through the catalog flow and are tracked as `source_kind = manual`.
- Tax regime changes call `apply_regime_change_default_obligations`, adding the new regime defaults and inactivating prior-regime future defaults without deleting completed history.

## Rollback

Rollback must preserve client profiles and generated instances.

Recommended rollback path:

1. Disable UI actions that publish or synchronize loads.
2. Disable automatic default application in client creation and client tax-regime updates.
3. Keep new tables readable for investigation.
4. Do not delete generated profiles or historical obligation instances.
5. If needed, set active loads to `in_review` to block automatic application.

## Validation Checklist

- One active load per organization and regime.
- Shared obligations are seeded once in the master catalog.
- Conditional items include `condition_key`.
- New-client application creates links only.
- Sync runs do not mutate `obligation_instances`, tasks, calendar events, documents or protocols.
- RLS blocks anonymous and portal users from load-management tables.
- Catalog UI blocks edit/delete actions for system default definitions.
- Backend rejects direct edit/delete attempts for non-manual template definitions.
