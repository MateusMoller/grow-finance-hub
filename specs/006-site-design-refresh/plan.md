# Implementation Plan: Site Design Refresh

**Branch**: `006-site-design-refresh` | **Date**: 2026-07-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-site-design-refresh/spec.md`

**Note**: This plan covers design planning only. Implementation tasks are generated later by `/speckit-tasks`.

## Summary

Refresh the Grow visual system across the public site, protected internal app and client portal so the product feels more minimal, professional, secure and consistent while preserving all current functionality. The technical approach is to redesign existing routes and shared shells in place, using the current palette as the foundation, tightening typography, spacing, surfaces, cards, forms, tables, navigation, responsive behavior and visual hierarchy without changing database, automation, permission, tenant, integration or business-rule behavior.

## Technical Context

**Language/Version**: TypeScript with React 18 in the existing Vite application

**Primary Dependencies**: React Router, Tailwind CSS, shadcn/Radix UI primitives, lucide-react icons, framer-motion already present, existing local site components and lead/newsletter helpers

**Storage**: No new storage. Existing lead/newsletter, app, portal, document and operational flows remain unchanged.

**Testing**: `npm run lint`, `npm run test`, `npm run build`; browser visual QA on public, internal and portal routes at desktop, tablet and mobile widths

**Target Platform**: Existing web application routes: public site, protected internal app and protected client portal

**Project Type**: Single React web application with public site, protected internal app and protected client portal routes

**Performance Goals**: Public pages should keep fast perceived initial content and visible calls to action; internal and portal pages should preserve operational density, responsive stability and fast perceived interaction for tables, filters, lists and forms.

**Constraints**: Preserve current brand palette, routing, forms, contact paths, login/portal links, legal links, module actions, filters, permissions and data scope; avoid misleading claims, unsupported metrics, heavy decoration, one-note palettes or functional regressions.

**Scale/Scope**: Public site shell/pages, protected internal app shell/modules and protected client portal screens. Priority public files include `SiteLayout`, `SiteHeader`, `SiteFooter`, `SiteWordmark`, `SiteWhatsAppButton`, `AboutPage`, `HomePage`, `SolutionsPage`, `ContactPage`, `NewsletterPage`, `PrivacyPage`, `TermsPage`, and `NotFound` if visually inconsistent. Internal and portal scope includes shared app layout/navigation plus core modules such as Dashboard, Clientes, Tarefas, Calendário, CRM, Relatórios, Financeiro, Obrigações, Usuários, Notificações, Configurações and client portal views.

**Affected Surfaces**: Public site, internal app and client portal visuals only. Supabase database, Edge Functions, Storage, automations/webhooks, permissions, tenant isolation and external integrations are out of scope except existing UI behavior must remain intact.

**Security/Tenant Scope**: No role, permission, tenant, RLS, storage or credential changes. Public routes remain unauthenticated; protected internal and portal routes remain authenticated and must not expose broader data through visual changes.

**Business Rule Owner**: Frontend UI for visual presentation only. Existing lead/newsletter/contact behavior, operational rules and portal behavior remain owned by existing helpers, backend functions and data rules.

**Observability/Rollback**: No new audit logs or migrations. Rollback is reverting visual component/page changes. Public, internal and portal screens must keep controlled loading/success/error/empty/permission feedback.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Security and Least Privilege

- [x] Public, internal, and client-portal surfaces remain separated by route,
      role, and backend authorization.
- [x] No secrets, service-role keys, OpenAI/WhatsApp/Open Finance/Acessorias
      credentials, or integration tokens are exposed to client code or logs.
- [x] Privileged operations validate JWT, organization, role, client access,
      action intent, and input shape before using service-role access.
      Not applicable to this visual-only public redesign; no privileged operation is added or changed.

### Tenant Isolation and Data Segregation

- [x] New or changed operational data is organization-aware.
      No operational data is added or changed.
- [x] Client portal flows enforce client-level access through `client_users`
      or a documented legacy fallback.
      Client portal is visual-only scope and remains protected.
- [x] RLS, storage policies, and signed URL scope are addressed for affected
      tables/files.
      No table, storage or signed URL changes.

### Backend-Owned Business Rules

- [x] Authorization, synchronization, deduplication, automation, completion,
      document classification, financial state, obligation state, and external
      integration rules live in the responsible backend layer.
      No business-critical rule changes are planned.
- [x] Any frontend-only rule is non-sensitive, justified, and backed by backend
      validation where data integrity or access control matters.
      Planned frontend-only work is visual presentation and responsive layout.

### Scalable Frontend and Data Access

- [x] Shared/repeated remote state uses TanStack Query or a justified existing
      pattern.
      Existing public, internal and portal data-loading helpers remain unchanged unless a visual-only refactor preserves the same query behavior.
- [x] Independent requests start early and use `Promise.all` where safe.
      No new independent request sets are planned.
- [x] High-volume lists, filters, tables, and derived state use pagination,
      server filtering, indexing, `Map`/`Set`, virtualization, or another
      concrete scaling strategy.
      High-volume operational screens are visual-only scope; existing query, pagination, filtering and data-loading behavior must be preserved.
- [x] Public routes avoid importing internal-only workflows or heavy
      dependencies.
      Design must reuse existing components and avoid adding new heavy dependencies.

### Auditability, Reliability, and Operability

- [x] Operational state changes have audit/logging coverage sufficient to
      identify actor, organization, client, action, and integration/automation.
      No operational state change is introduced.
- [x] Integration and webhook failures fail closed for sensitive actions and
      return controlled UI errors.
      Existing public, internal and portal feedback remains controlled.
- [x] Validation commands are identified: `npm run lint`, `npm run test`,
      `npm run build`, or `npm run verify:deploy`.
- [x] Migrations that alter RLS, constraints, tenant scope, or critical tables
      include rollout and rollback considerations.
      No migration is planned.

## Project Structure

### Documentation (this feature)

```text
specs/006-site-design-refresh/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── public-site-visual-contract.md
│   └── internal-portal-visual-contract.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── App.tsx
├── components/
│   ├── site/
│   │   ├── SiteFooter.tsx
│   │   ├── SiteHeader.tsx
│   │   ├── SiteLayout.tsx
│   │   ├── SiteWhatsAppButton.tsx
│   │   └── SiteWordmark.tsx
│   └── ui/
├── lib/
│   ├── newsletter.ts
│   └── siteLeadCapture.ts
└── pages/
    ├── AboutPage.tsx
    ├── ContactPage.tsx
    ├── HomePage.tsx
    ├── NewsletterPage.tsx
    ├── PrivacyPage.tsx
    ├── SolutionsPage.tsx
    └── TermsPage.tsx
```

**Structure Decision**: Use the existing single-app route structure. Keep the redesign inside existing page/layout/component boundaries; do not introduce a new design package or new routing layer. Shared UI primitives under `src/components/ui/*` may be reused or visually tuned only when public, internal and portal impact is reviewed together.

## Complexity Tracking

No constitution violations are expected. No added architectural complexity is justified for this visual-only redesign.

## Phase 0 Research Summary

Research decisions are captured in [research.md](./research.md). The key decisions are:

- Use a restrained professional-services visual language: clean hierarchy, credible typography, controlled spacing, and visible trust cues for public pages.
- Use a restrained product-operations visual language for internal and portal pages: dense but organized layouts, clear table/form states, stable controls and consistent navigation.
- Keep the current palette as foundation, but tune surfaces, borders, accents and contrast for a more secure and premium tone.
- Prefer real/brand-relevant visuals and operational credibility over generic decorative graphics or unsupported metrics.
- Preserve route and form behavior while improving visual structure and responsive polish.

## Phase 1 Design Summary

Design artifacts are captured in:

- [data-model.md](./data-model.md): public page, internal module, portal screen, visual section, CTA/action, brand style and QA entities.
- [contracts/public-site-visual-contract.md](./contracts/public-site-visual-contract.md): visual and UX acceptance contract for public routes.
- [contracts/internal-portal-visual-contract.md](./contracts/internal-portal-visual-contract.md): visual and UX acceptance contract for protected internal and portal routes.
- [quickstart.md](./quickstart.md): validation workflow for implementation and review.

## Post-Design Constitution Check

The design remains compliant:

- Public, internal and portal visual surfaces are affected.
- No protected route access, data access rule, tenant boundary or backend-owned business rule changes are planned.
- Existing public form, internal operational and portal behavior remains intact.
- Performance and accessibility validation are explicitly part of quickstart.
- Rollback is simple because changes are limited to visual files and no migration is introduced.
