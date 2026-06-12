# Current Reports Inventory

Current report page: `src/pages/RelatoriosPage.tsx`

## Datasets

| Dataset | Current source | Notes |
|---------|----------------|-------|
| Clientes | `clients`, `client_data` | Includes general client fields and cadastral derived fields. Credential-like fields must be blocked from direct report export. |
| Leads e CRM | `site_leads` | Contains lead identity, contact and origin data. |
| Tarefas | `kanban_tasks` | Contains operational work, sector, assignee, status and due dates. |
| Equipe | `profiles`, `user_roles` | Contains internal user identity and role data; should be limited to management roles. |

## Current saved model behavior

Saved models use `saved_reports` with owner-only access by `user_id`, dataset id, selected columns, format and timestamps. The restructure hardens this with organization scope and catalog validation.

## Current export behavior

The current page imports `xlsx` dynamically and writes files in the browser. The restructure keeps XLSX as the first format but requires backend-owned validation for sensitive or high-volume exports.
