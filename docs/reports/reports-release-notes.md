# Reports Restructure Release Notes

## Added

- Governed report catalog for Clientes, Leads e CRM, Tarefas and Equipe.
- Field classification with prohibited credential-like field blocking.
- Active dataset preview with bounded row rendering.
- Personal saved report models with tenant scope and stale-column diagnostics.
- Secure export policy with backend validation path for sensitive exports.
- Report field search, grouping and selected-column ordering.
- Migration to harden `saved_reports` with `organization_id` and `normalized_name`.

## Changed

- `RelatoriosPage.tsx` now composes report services and components instead of owning all report business rules.
- Report data is loaded by active dataset rather than all datasets on page open.

## Known limitations

- Backend XLSX file generation is not enabled yet for sensitive exports; the Edge Function validates and blocks unsafe paths.
- Local automated validation requires Node >=22.12.0; current PATH uses Node 18.20.8.
