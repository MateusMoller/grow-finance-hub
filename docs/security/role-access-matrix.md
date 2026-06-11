# Role Access Matrix

Evidence source: `src/lib/accessControl.ts`.

| Role | Type | Baseline capability | Security notes |
| --- | --- | --- | --- |
| admin | internal | Full internal administration. | Must be validated in backend and RLS for privileged actions. |
| director | internal | Broad internal visibility. | Should not bypass organization/client boundaries. |
| manager | internal | Team and operational management. | Validate department and assigned-work constraints where applicable. |
| employee | internal | Standard internal workflows. | Sensitive reports and user management require explicit restrictions. |
| commercial | internal | CRM/commercial workflows. | Avoid access to financial, payroll or private documents unless required. |
| partner | internal | Partner-facing internal workflows. | Needs explicit data-boundary validation. |
| departamento_pessoal | department | Department-specific workflows. | `isDepartmentOnlyUser` identifies department-only users without elevated roles. |
| fiscal | department | Fiscal workflows. | Must be scoped to allowed clients/tasks. |
| contabil | department | Accounting workflows. | Must be scoped to allowed clients/tasks. |
| client | portal | Client portal access. | Critical: must access only linked client/organization data. |

## Helper Review

- `INTERNAL_ROLE_LIST` defines internal roles.
- `DEPARTMENT_ROLE_LIST` defines department-only candidate roles.
- `CLIENT_ROLE` defines portal users.
- `hasPortalAccessRole` allows client or internal users to reach portal flows.
- `getPrimaryRole` resolves role priority, so multi-role users require backend validation for each sensitive action.

## Required Validation

- Cross-client portal access.
- Department-only user attempting restricted internal action.
- Internal user attempting out-of-organization client access.
- User-management actions by non-admin roles.

## Code Evidence

- `src/hooks/useAuth.tsx` reads `user_roles` with `role, organization_id` and stores `currentOrganizationId`, so organization context exists in the frontend session model.
- `src/App.tsx` wraps internal routes with `ProtectedRoute scope="internal"` and the portal route with `ProtectedRoute scope="portal"`.
- `src/pages/PortalClientePage.tsx` remains critical because portal access must be proven against backend/RLS using the staging cross-client scenario.
- `supabase/functions/create-team-user/index.ts` extracts bearer JWT, uses service role only server-side, checks caller admin roles by `organization_id`, validates manageable roles and writes user roles/profiles.
- `supabase/functions/manage-team-user/index.ts` and `supabase/functions/create-admin/index.ts` require staging validation for role escalation and organization boundaries.
