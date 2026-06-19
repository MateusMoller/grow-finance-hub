# Obligation Regime Loads

## Ownership

The native Grow obligations module remains the source of truth for obligation catalog, client links and generated obligation instances. Regime loads are not a parallel module; they are governed memberships between one master obligation and one tax-regime load.

Sensitive rules must stay in `grow-obligations-module` and database constraints:

- tax regime normalization
- duplicate prevention
- conditional applicability
- new-client load application
- existing-client synchronization after published load changes
- regime migration preview and confirmation

The React UI can show previews, warnings and confirmations, but it is not the only enforcement layer.

## Baseline Catalog

Baseline master obligations are seeded once by stable code. Shared obligations such as `fgts`, `esocial`, `dctfweb_mit` and `efd_reinf` are reused by multiple regime loads instead of copied.

Supported initial regimes:

- Simples Nacional
- Lucro Presumido
- Lucro Real
- MEI

Each load item can be:

- `required`: automatically linked when the load applies
- `optional`: available for manual selection
- `conditional`: linked only when client evidence proves applicability

## Conditional Evidence

Conditional items depend on explicit client evidence. When evidence is missing, the backend must create a review warning instead of creating an active client-obligation profile.

Initial condition keys:

- `has_employees`
- `iss_applicable`
- `icms_taxpayer`
- `service_provider`
- `accounting_contracted`

## New Client Application

New-client load application creates client-obligation links only. It must not generate competencies, tasks, calendar events, documents or protocols. Generation remains an explicit obligation workflow.

## Published Load Synchronization

When an active load is published, existing clients in the same normalized regime are synchronized for active/future profile links only. Generated history remains unchanged.

Branches with their own tax regime follow that regime. Branches inheriting a parent regime are marked for review.

## Duplicate Prevention

Duplicates are evaluated by code, normalized name and semantic aliases. `FGTS`, `F.G.T.S.` and `FGTS mensal` must resolve to the same master obligation family and be blocked or sent to review before save.
