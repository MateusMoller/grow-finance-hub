# UI Contract: Obrigacoes - Cargas por Regime

## Catalogo Tab

The existing `catalogo` tab must expose three coordinated areas:

- Master obligation catalog
- Regime load selector/list
- Load item membership for the selected regime

Required visible controls:

- Search obligation by name/code
- Filter by regime
- Filter by sector
- Filter by status
- Filter duplicate-risk obligations
- Select regime load status: active, inactive, in review
- Add existing master obligation to load
- Create new master obligation
- Edit master obligation
- Remove/deactivate item from load
- Activate/deactivate load with validation warnings

Required states:

- Loading catalog
- Empty regime load
- Load in review
- Duplicate warning
- Missing active load
- Inactive template referenced by load
- Save success
- Controlled save failure
- Published load synchronization queued/running/completed
- Existing-client sync warnings and review-required count

## New Client Flow

When a user creates a company with a supported tax regime:

- UI sends regime as part of the existing create-client flow.
- Backend applies the active load after client creation.
- UI shows success summary: number of obligations linked, skipped and warnings.
- If no active load exists, client creation must still succeed, but UI must show the obligation load warning.

Required user-facing outcomes:

- "Carga aplicada" state
- "Carga nao aplicada" warning with reason
- Link/action to review client obligations
- Conditional item review count when client data is insufficient
- No automatic competency/task/calendar generation message

## Client Detail Regime Change

When a user changes tax regime for an existing client:

- UI must not silently apply the new load.
- UI shows preview action for the new regime.
- Preview shows add/keep/reactivate/suggest inactivation/duplicate risk counts.
- User explicitly confirms destructive or inactivation decisions.

Required states:

- No active load for selected regime
- Preview available
- Confirmation required
- Applied successfully
- Partial/controlled failure
- Branch inherited-regime review required

## Published Load Synchronization

When a manager publishes changes to an active standard load:

- UI must show that existing clients of the same regime will be synchronized automatically.
- UI must show impact summary after synchronization.
- UI must state that generated competencies, tasks, calendar events, documents and protocols were not changed.
- Branches inheriting parent regime must appear as review-required items.

Required states:

- Sync pending
- Sync running
- Sync completed
- Sync completed with warnings
- Sync failed with retry guidance

## Client Obligations Panel

The client obligation list must show enough origin context:

- Standard load
- Manual addition
- Regime migration
- Exception
- Legacy

Required controls:

- Add individual obligation
- Inactivate individual obligation
- Edit due overrides
- Generate competencies
- View load application history or latest batch summary
- View latest standard-load synchronization result when applicable

## Accessibility and UX

- All primary actions must be buttons with accessible labels.
- Destructive actions require confirmation.
- Tables/lists must remain usable on mobile and desktop.
- Long obligation lists must be searchable and bounded.
- Text must not overflow compact buttons, badges or rows.
