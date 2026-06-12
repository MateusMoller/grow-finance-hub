# Research: Reestruturacao Profissional do Modulo de Relatorios

## Decision 1: Use a governed report catalog as the source of truth

**Decision**: Define datasets and fields through a centralized report catalog with dataset id, label, description, source, filters, roles, field definitions, data classification, formatter and export behavior.

**Rationale**: The current module concentrates dataset definitions, labels, formatting and UI behavior in one page. A catalog makes the reporting surface auditable, lets saved models validate against current field definitions and prevents sensitive fields from appearing by accident.

**Alternatives considered**:
- Keep definitions inside the page: rejected because it continues the monolith and makes security review harder.
- Store every catalog definition only in the database from the start: deferred because initial rules can be versioned with code while the team stabilizes the domain contract.

## Decision 2: Keep personal saved models in `saved_reports`, but make them tenant-aware and catalog-validated

**Decision**: Preserve personal saved model behavior while requiring `organization_id`, normalized uniqueness rules, column validation and invalid-field reporting when models are loaded.

**Rationale**: Personal models are already part of the user workflow and reduce disruption. The feature must not silently run stale or unauthorized columns, especially as catalog governance evolves.

**Alternatives considered**:
- Replace personal models with organization-wide templates immediately: rejected for scope control and because sharing rules require additional approval workflows.
- Leave existing owner-only RLS as-is: rejected because the constitution requires organization-aware operational data.

## Decision 3: Backend-owned authorization for sensitive exports

**Decision**: Low-risk preview/UI composition can remain client-orchestrated, but sensitive exports, volume limits, field sensitivity checks and audit must be enforced by backend-owned Supabase RPC/Edge Function before data is exported.

**Rationale**: Report exports can contain client, fiscal, labor, financial and user-role data. UI-only checks are not sufficient protection, and exports need a reliable audit record at generation time.

**Alternatives considered**:
- Continue generating all XLSX files in the browser: acceptable only for explicitly low-risk, bounded datasets; rejected as the default for sensitive reports.
- Move every preview and export to a new backend service immediately: safer but heavier; the plan allows staged movement while enforcing backend ownership for sensitive and high-volume flows.

## Decision 4: Use TanStack Query for report remote state

**Decision**: Dataset metadata, saved report models, preview requests and export status should be modeled as TanStack Query queries/mutations.

**Rationale**: The project already uses TanStack Query. It gives cache keys by organization/dataset/filter, loading/error states, invalidation for saved models and avoids manual duplicated state.

**Alternatives considered**:
- Continue manual `useState` and `useEffect`: rejected for repeated remote state and partial failure handling.
- Introduce another data-fetching library: rejected because the existing stack already provides the needed behavior.

## Decision 5: Load datasets independently with bounded previews

**Decision**: Split dataset loading by active dataset and filters, with independent query status per dataset. Preview results are bounded and export requires explicit generation.

**Rationale**: The current all-at-once load makes one failing or slow source affect the whole screen. Independent loads satisfy partial failure requirements and reduce initial route cost.

**Alternatives considered**:
- Load all report data on page open: rejected for performance and reliability.
- Load only after export: rejected because users need preview and validation before generating files.

## Decision 6: Prohibit credential-like fields by default

**Decision**: Fields with names or classifications equivalent to password, senha, token, secret, credential, key or raw document content are unavailable for direct preview/export unless a separate approved secure workflow is specified.

**Rationale**: The current conceptual client data includes sensitive indicators such as senha GOV. Report tooling should not become a bulk secret export mechanism.

**Alternatives considered**:
- Allow admin-only export of all fields: rejected because even admin reports should follow least privilege and business justification.
- Mask only in UI while keeping raw export available: rejected because file export is the higher-risk surface.

## Decision 7: Reuse operational audit infrastructure

**Decision**: Use the existing operational audit pattern for report export events and model mutations, extending metadata for dataset, filters, selected fields, row count, result and classification.

**Rationale**: The repository already has `recordOperationalAuditLog` and an operational audit table/function. Reuse avoids inventing a parallel audit surface and keeps incident review consistent.

**Alternatives considered**:
- Log only to browser console/toast: rejected because it is not auditable.
- Create a report-only audit table first: possible later, but not necessary if operational audit metadata is sufficient.

## Decision 8: Keep XLSX as the first export format

**Decision**: XLSX remains the required export format for the first implementation, with CSV/PDF reserved for later explicit requirements.

**Rationale**: The current module already uses XLSX and the user specification expects an operational spreadsheet workflow. Keeping one format reduces validation scope.

**Alternatives considered**:
- Add CSV immediately: deferred because format expansion is not required to solve reliability/security.
- Add PDF/dashboard rendering immediately: deferred as a separate reporting product feature.
