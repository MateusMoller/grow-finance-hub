# Reports Module Restructure

This feature moves the internal reports module toward a governed reporting surface with cataloged datasets, field classification, tenant-aware saved models, bounded previews and secure export validation.

Primary implementation guardrails:
- Keep report business rules outside `src/pages/RelatoriosPage.tsx`.
- Treat dataset and field definitions as governed catalog entries.
- Block credential-like fields by default.
- Keep saved report models personal unless a later feature specifies sharing.
- Route sensitive or high-volume export decisions through backend-owned validation.

Initial source modules:
- `src/lib/reports/`
- `src/hooks/reports/`
- `src/components/reports/`
- `supabase/functions/report-exports/`
