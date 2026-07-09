# Internal App and Client Portal Visual Contract

This contract defines acceptance expectations for the visual-only redesign of protected internal modules and client portal screens.

## Affected Internal Surfaces

- Main authenticated app shell and navigation
- Dashboard
- Calendario
- Tarefas
- Clientes and client detail tabs
- CRM
- Chat Interno
- Newsletter
- Relatorios
- Financeiro
- Obrigacoes
- Usuarios
- Notificacoes
- Sugestoes
- Manual de uso
- Configuracoes

## Affected Client Portal Surfaces

- Client portal shell and navigation
- Client-facing authenticated pages currently available in the app
- Client-scoped lists, forms, documents, messages and status views

## Visual-Only Contract

Each affected protected screen must satisfy:

- Preserves existing route access and authentication requirements.
- Preserves role, organization, client and module permission behavior.
- Preserves existing data source, query shape, filters, ordering, pagination and mutations.
- Preserves every currently available action, button, form field, validation, tab and status.
- Does not add, remove or reinterpret business rules.
- Does not expose protected data in new locations or to broader audiences.
- Keeps existing loading, empty, error, success and permission-denied states visible and understandable.

## Product UI Contract

Internal and portal screens must satisfy:

- Uses the current Grow palette as the base.
- Improves visual hierarchy while preserving operational density.
- Makes tables, lists, filters and forms easier to scan.
- Keeps primary actions visible without hiding secondary operational actions.
- Uses stable dimensions for dense controls, toolbars, tables, cards and modal content.
- Avoids decorative marketing composition inside operational modules.
- Avoids nested cards where a simple section, table, toolbar or panel is clearer.
- Keeps text readable and prevents overlap, clipping and horizontal page overflow.
- Keeps keyboard focus, disabled states and hover states visible.

## Module-Specific Review Points

- **Clientes**: Client lists, detail tabs, obligations and pending items remain complete and scoped to the selected client.
- **Tarefas/Kanban/Calendario**: Operational status, deadlines, assignees, sector cues and actions remain visible.
- **Relatorios**: Preview tables, filters, export actions and report-management flows remain readable and complete.
- **Obrigacoes**: Catalog, central documents, routing preview, client selection, expected documents and file upload controls remain visible and usable.
- **Usuarios**: Role, sector, module access and audit/history views remain permission-safe and clear.
- **Portal do Cliente**: Client-visible data remains client-scoped and action paths remain unchanged.

## Visual QA Viewports

Minimum manual review widths:

- 390px mobile
- 768px tablet
- 1280px desktop
- 1536px wide desktop

## Blocking Failures

The redesign is not acceptable if any affected protected screen has:

- Any unauthorized route, menu, data or action exposure.
- Existing action, filter, field, tab or validation removed.
- Horizontal page scroll caused by layout overflow.
- Text, controls, tables or buttons overlapping.
- Primary operational action hidden or inaccessible.
- Table/list density reduced enough to materially slow repeated work.
- Existing upload, export, save, send, edit or delete behavior broken.
- Loading, empty, error or permission-denied state hidden or unclear.
