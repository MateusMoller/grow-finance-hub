# Research: Default Obligations by Tax Regime

## Decision: Reuse native obligation regime loads as the default-set mechanism

**Rationale**: The existing native obligations model already has master obligations, tax regime definitions, regime loads, load items, client profiles, application batches, item-level application decisions, sync runs, and audit events. Reusing this model avoids a parallel "default obligations" module and preserves deduplication, tenant scope, source tracking, and historical compatibility.

**Alternatives considered**:

- Add hardcoded defaults directly in the client-registration screen. Rejected because frontend-only defaults would bypass backend validation, audit, and tenant-safe source tracking.
- Create a separate table only for registration defaults. Rejected because it would duplicate regime-load membership and create divergent sources of truth.

## Decision: Keep default application backend-owned

**Rationale**: Applying default obligations changes operational fiscal/labor data and can create client-obligation profiles. It must validate user role, active organization, client ownership, tax regime, duplicate risk, and conditional evidence before writing. The backend can also return a consistent application summary and warnings to every caller.

**Alternatives considered**:

- Let the UI call direct inserts for each default obligation. Rejected because partial failures and duplicate prevention would be hard to enforce consistently.
- Use database triggers on every client insert. Rejected for this phase because obligation application needs role-aware audit, controlled errors, and explicit behavior during regime changes and evidence updates.

## Decision: Generic matrix only; sector-specific obligations remain manual or future specialized defaults

**Rationale**: The user explicitly requested generic obligations by tax regime for now. Obligations such as DMED, DIMOB, DOI, e-Financeira, and construction-specific routines depend primarily on line of business and require separate evidence. Keeping them out reduces false positives and preserves user trust.

**Alternatives considered**:

- Include every possible federal/state/municipal obligation. Rejected because it would overload companies with non-applicable tasks and require detailed sector data not guaranteed at registration.
- Include sector obligations as optional defaults. Rejected for now because optional defaults still add noise and should be handled by a separate sector-matrix feature.

## Decision: Conditional obligations require positive evidence and auto-apply later

**Rationale**: Many generic obligations depend on attributes such as employees, service provision, municipal requirement, state registration, ICMS/IPI taxpayer status, retentions/services, ECD applicability, EFD-Contribuicoes applicability, and tax benefit usage. When positive evidence exists, the backend applies the obligation. When evidence is missing or inconclusive, the backend skips the conditional item with an auditable reason and automatically applies it later when a relevant company attribute is updated with positive evidence.

**Alternatives considered**:

- Apply all conditionals by default. Rejected because it creates excessive false obligations.
- Create review-required items for missing evidence. Rejected by clarification because the system should not create manual review work for missing conditional evidence.
- Skip all conditionals forever when data is incomplete. Rejected because later positive evidence must bring the obligation into future control automatically.

## Decision: Manual obligations remain additive and source-tagged

**Rationale**: Users need to create additional obligations without changing the standard defaults for every company. Manual obligations should be visible as manual source links and must not mutate default load membership. System default definitions are governed through controlled technical maintenance only.

**Alternatives considered**:

- Convert manual obligations into default-load items automatically. Rejected because it would unintentionally affect other companies.
- Let managers edit default-load membership through the application UI. Rejected by clarification because default obligation changes are technical maintenance only.
- Forbid manual obligations when defaults exist. Rejected because real accounting operations need exceptions and local rules.

## Decision: Regime changes apply future default alignment automatically

**Rationale**: Companies may change from one tax regime to another while past obligations, documents, protocols, and completed competencies remain legally relevant. The system should automatically inactivate future active default obligations from the prior regime, apply future defaults from the new regime, avoid duplicates for shared obligations, and preserve completed history without requiring a separate confirmation step.

**Alternatives considered**:

- Delete old regime obligations and recreate new ones. Rejected because it risks losing history and audit context.
- Leave all old obligations active. Rejected because future control becomes inconsistent with the current tax regime.
- Require a preview/confirmation step. Rejected by clarification because supported regime changes should align future defaults automatically.
