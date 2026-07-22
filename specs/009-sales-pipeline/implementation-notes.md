# Sales Pipeline Implementation Notes

## Compatibility Strategy

- The existing `crm_leads` table remains the operational opportunity table to avoid breaking the current Vendas module.
- New sales-specific behavior is added with additive columns and auxiliary tables:
  - `crm_pipeline_stages` for editable pipeline stages.
  - `crm_commercial_offers` for the editable commercial catalog.
  - `crm_commercial_leads` for prospects that are not clients yet.
  - `crm_opportunity_activities` for timeline/activity history.
  - `crm_client_completion_tasks` for the task generated when a new-client opportunity is won.

## New Client Flow

- Winning an opportunity can call `crm_win_new_client_opportunity`.
- The function creates a pending `clients` row when the opportunity is not linked to an existing client.
- The function creates one Commercial-sector Kanban task for registration completion and deduplicates by opportunity.
- The generated task has no individual assignee by default, matching the requirement that only the responsible sector is mandatory.

## Frontend Strategy

- Shared sales helpers live in `src/lib/salesPipeline.ts`.
- Data access for the new tables lives in `src/lib/salesPipelineData.ts` and uses local types until generated Supabase types are refreshed.
- Reusable UI components live in `src/components/sales`.
