# UI Contract: Pipeline de Vendas Comercial

## Main Vendas Page

**Purpose**: Daily commercial operation surface.

**Required Areas**:

- Module context pill identifying pipeline comercial.
- Compact header with title "Vendas" and primary action "Nova oportunidade".
- Discreet settings/menu action for administrators and managers to manage pipeline stages and commercial catalog.
- Summary indicators for open value, active opportunities, won/lost results and conversion.
- Filters for period, stage, status, responsible, client, sale type, offer and source.
- Search by opportunity, client, contact, CNPJ, phone, email or offer.
- Pipeline board grouped by stage.
- Secondary list/table mode may exist for dense review.

## Opportunity Card

**Must Display**:

- Opportunity title.
- Client or lead name.
- Sale type or offer.
- Estimated value or "sem valor estimado" signal.
- Responsible user.
- Next step/follow-up or warning when missing.
- Visual status for overdue/stale opportunities.

## New/Edit Opportunity Flow

**Must Support**:

- Choose existing client.
- Create commercial lead/new client draft.
- Select sale type and product/service offer.
- Use "Outro" with a required free description when the offer is not in the catalog.
- Define value, recurrence, source, stage, expected close date and responsible.
- Add notes/context.
- Warn about possible duplicate client/lead.

## Opportunity Detail

**Must Support**:

- Edit core commercial fields.
- Register activity or note.
- Define and complete follow-ups.
- Move stage.
- Mark as won or lost.
- When marking a new-client opportunity as won, show that a pending client and Commercial-sector completion task will be created.
- Reopen when authorized.
- View immutable history.

## Pipeline and Catalog Management

**Must Support for administrators/managers**:

- Create, edit, reorder and deactivate pipeline stages.
- Create, edit and deactivate commercial catalog items.
- Keep inactive stages/offers visible in historical opportunities.

**Must Block for ordinary commercial users**:

- Managing stages.
- Managing catalog items.
- Editing inactive historical catalog or stage records.

## Empty and Error States

- Empty pipeline stage still appears.
- No opportunities found state must explain active filters.
- Permission failure must show controlled access message.
- Save failures must preserve form input and show actionable error.
- Automatic client/task creation failures must explain that the opportunity was not finalized as won.
