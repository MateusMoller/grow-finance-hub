# Reports Tenant Isolation Review

## Reviewed surfaces

- Internal route: `/app/relatorios`
- Feature flag: `relatorios`
- Saved models: `saved_reports`
- Report catalog and preview services
- Export validation Edge Function

## Findings

- The route remains under `ProtectedRoute` with internal scope and `feature="relatorios"`.
- Report queries require `currentOrganizationId` before loading.
- `saved_reports` migration adds required `organization_id` and owner-only RLS scoped to internal users.
- Client role is blocked from internal report datasets by catalog permission rules.
- Portal-specific reports remain out of scope and should require a separate client-level contract through `client_users`.

## Residual risk

- Some legacy source tables may still rely on transitional tenant compatibility. Dataset-specific implementation must keep organization filters in every query.
