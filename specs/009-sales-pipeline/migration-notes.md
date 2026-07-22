# Migration Notes

## Current to Target Mapping

- Existing `crm_leads` rows continue to represent sales opportunities.
- Additive columns on `crm_leads` store client linkage, commercial offer, recurrence, probability, owner, expected close date, close metadata, and generated completion task reference.
- Existing `site_leads` records remain importable into `crm_leads`; no destructive migration is applied.
- Existing `clients` records are linked through `crm_leads.client_id` for existing-client opportunities.
- New-client opportunities can be converted through `crm_win_new_client_opportunity`, which creates a pending client and one Commercial-sector Kanban task.

## Rollback Notes

- The migration is additive and non-destructive.
- Rolling back UI usage can ignore the new tables/columns while preserving current `crm_leads`, `crm_goals`, and `crm_lead_events` behavior.
- If a database rollback is required, drop the new auxiliary tables first, then remove the added `crm_leads` columns after checking for production data.
