# Tasks: Site Design Refresh

**Input**: Design documents from `/specs/006-site-design-refresh/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/public-site-visual-contract.md](./contracts/public-site-visual-contract.md), [quickstart.md](./quickstart.md)

**Tests**: No formal TDD requested. Validation tasks use existing quality gates and manual visual QA from `quickstart.md`.

**Organization**: Tasks are grouped by user story so each story can be implemented and visually validated independently. Public pages and operational protected modules are separated because they require different visual density.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the design baseline and guardrails before visual edits.

- [ ] T001 Review current public route map in `src/App.tsx` and confirm affected public routes from `specs/006-site-design-refresh/contracts/public-site-visual-contract.md`
- [ ] T001a Review protected internal and portal route map in `src/App.tsx` and confirm representative protected routes from `specs/006-site-design-refresh/contracts/internal-portal-visual-contract.md`
- [ ] T002 [P] Inventory existing public shell components in `src/components/site/SiteLayout.tsx`, `src/components/site/SiteHeader.tsx`, `src/components/site/SiteFooter.tsx`, `src/components/site/SiteWordmark.tsx`, and `src/components/site/SiteWhatsAppButton.tsx`
- [ ] T003 [P] Inventory existing public page layouts in `src/pages/AboutPage.tsx`, `src/pages/HomePage.tsx`, `src/pages/SolutionsPage.tsx`, `src/pages/ContactPage.tsx`, `src/pages/NewsletterPage.tsx`, `src/pages/PrivacyPage.tsx`, and `src/pages/TermsPage.tsx`
- [ ] T003a [P] Inventory existing internal app and portal shell/layout components, navigation components and shared UI dependencies used by protected modules
- [ ] T004 Document current public CTAs, forms, login links, portal links, legal links, WhatsApp paths, internal module actions and portal actions in `specs/006-site-design-refresh/visual-baseline.md`
- [ ] T005 Capture before-state screenshots for `/`, `/inicio`, `/solucoes`, `/contato`, `/newsletter`, `/privacidade`, `/termos`, representative internal modules and representative portal routes at 390px and 1280px in `specs/006-site-design-refresh/visual-baseline.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Define reusable visual direction and shared shell changes that all public, internal and portal pages depend on.

**CRITICAL**: No user-story page redesign should begin until this phase is complete.

- [ ] T006 Define public-site visual tokens and reusable class patterns for surfaces, sections, buttons, forms and cards in `src/components/site/SiteLayout.tsx`
- [ ] T007 Update public header navigation treatment, spacing, active states and mobile menu polish in `src/components/site/SiteHeader.tsx`
- [ ] T008 Update public footer layout, newsletter block, link hierarchy and mobile readability in `src/components/site/SiteFooter.tsx`
- [ ] T009 [P] Verify `src/components/site/SiteWordmark.tsx` scales cleanly in header, footer and mobile navigation without cropping
- [ ] T010 [P] Verify `src/components/site/SiteWhatsAppButton.tsx` remains visible but non-obstructive across mobile and desktop public routes
- [ ] T011 Review public route imports in `src/App.tsx` to ensure public pages do not import internal-only workflows or protected app dependencies
- [ ] T011a Review shared UI primitive usage to ensure any visual token/class changes are safe for public, internal and portal screens without changing behavior

**Checkpoint**: Shared visual direction is coherent and all public, internal and portal representative routes still load.

---

## Phase 3: User Story 1 - Primeiro impacto profissional e seguro (Priority: P1) MVP

**Goal**: Make the first public impression feel minimal, professional and secure while preserving immediate contact/access paths.

**Independent Test**: Visit `/` and `/inicio` at mobile and desktop widths. A first-time visitor should identify Grow, understand the offer and find contact/access paths within 5 seconds without layout overlap or horizontal scroll.

### Implementation for User Story 1

- [ ] T012 [US1] Redesign the first viewport and primary trust hierarchy in `src/pages/AboutPage.tsx`
- [ ] T013 [US1] Redesign the first viewport and primary trust hierarchy in `src/pages/HomePage.tsx`
- [ ] T014 [US1] Preserve and visually clarify primary contact, login and portal CTAs in `src/pages/AboutPage.tsx`
- [ ] T015 [US1] Preserve and visually clarify primary contact, login and portal CTAs in `src/pages/HomePage.tsx`
- [ ] T016 [US1] Replace or restyle unsupported/overstated trust indicators in `src/pages/HomePage.tsx` using only approved existing content
- [ ] T017 [US1] Ensure hero and first content sections in `src/pages/AboutPage.tsx` and `src/pages/HomePage.tsx` have stable responsive constraints for 390px, 768px, 1280px and 1536px widths
- [ ] T018 [US1] Validate `/` and `/inicio` against first-impression criteria in `specs/006-site-design-refresh/contracts/public-site-visual-contract.md`

**Checkpoint**: User Story 1 is independently complete and the public home/institutional first impression is ready for review.

---

## Phase 4: User Story 2 - Navegação comercial mais clara (Priority: P2)

**Goal**: Improve service discovery, contact flow and long-page readability across commercial pages.

**Independent Test**: Visit `/solucoes`, `/contato` and `/newsletter`; services must be scannable, contact paths visible, and forms/navigation preserved on mobile and desktop.

### Implementation for User Story 2

- [ ] T019 [P] [US2] Redesign service/category cards and section rhythm in `src/pages/SolutionsPage.tsx`
- [ ] T020 [P] [US2] Redesign contact page layout, form presentation and contact information hierarchy in `src/pages/ContactPage.tsx`
- [ ] T021 [P] [US2] Redesign newsletter page hierarchy, signup area and content cards in `src/pages/NewsletterPage.tsx`
- [ ] T022 [US2] Preserve existing lead capture behavior and required fields in `src/pages/ContactPage.tsx`
- [ ] T023 [US2] Preserve existing newsletter subscription behavior and required fields in `src/pages/NewsletterPage.tsx`
- [ ] T024 [US2] Ensure every commercial public page has a visible contact or conversion path without interrupting reading in `src/pages/SolutionsPage.tsx`, `src/pages/ContactPage.tsx`, and `src/pages/NewsletterPage.tsx`
- [ ] T025 [US2] Validate `/solucoes`, `/contato`, and `/newsletter` against route, form and visual style contracts in `specs/006-site-design-refresh/contracts/public-site-visual-contract.md`

**Checkpoint**: User Story 2 is independently complete and public commercial navigation is clearer.

---

## Phase 5: User Story 3 - Consistência visual em todo o site público (Priority: P3)

**Goal**: Make the full public site feel cohesive, including legal pages and edge states.

**Independent Test**: Move between all public routes and confirm header, footer, sections, forms, cards, legal content and responsive behavior share the same visual language.

### Implementation for User Story 3

- [ ] T026 [P] [US3] Align privacy page typography, spacing and legal content layout in `src/pages/PrivacyPage.tsx`
- [ ] T027 [P] [US3] Align terms page typography, spacing and legal content layout in `src/pages/TermsPage.tsx`
- [ ] T028 [P] [US3] Align public fallback/not-found presentation if needed in `src/pages/NotFound.tsx`
- [ ] T029 [US3] Normalize shared section spacing, card radii, border opacity, button hierarchy and form treatment across `src/pages/AboutPage.tsx`, `src/pages/HomePage.tsx`, `src/pages/SolutionsPage.tsx`, `src/pages/ContactPage.tsx`, and `src/pages/NewsletterPage.tsx`
- [ ] T030 [US3] Confirm mobile bottom navigation and public header do not compete or overlap in `src/components/site/SiteLayout.tsx` and `src/components/site/SiteHeader.tsx`
- [ ] T031 [US3] Validate all affected public routes against `specs/006-site-design-refresh/contracts/public-site-visual-contract.md`

**Checkpoint**: All user stories are visually cohesive and independently testable.

---

## Phase 6: User Story 4 - Interface interna mais profissional sem mudar fluxos (Priority: P4)

**Goal**: Make protected internal modules and client portal screens more polished, consistent and readable without changing permissions, data, filters, actions, validations or workflows.

**Independent Test**: Navigate representative internal modules and portal screens with valid users. Every existing action, data state, route access, permission block, filter, form and table/list interaction must remain available, while the visual hierarchy and consistency improve.

### Implementation for User Story 4

- [ ] T032 [US4] Audit protected app shell, sidebar/topbar, page headers, search, notification and profile controls for visual consistency without changing navigation behavior
- [ ] T033 [US4] Define internal product UI patterns for page headers, section panels, toolbars, filters, tables, forms, modals, empty states, loading states and error states using existing components
- [ ] T034 [US4] Apply visual polish to Dashboard, Calendario and Tarefas/Kanban screens while preserving current data loading, filters, statuses and actions
- [ ] T035 [US4] Apply visual polish to Clientes, client detail tabs and client obligations/pending sections while preserving client scoping and existing actions
- [ ] T036 [US4] Apply visual polish to CRM, Chat Interno, Newsletter and Notificacoes screens while preserving current communication/data behavior
- [ ] T037 [US4] Apply visual polish to Relatorios, Financeiro and Obrigacoes screens while preserving previews, exports, uploads, routing previews, forms and save/send actions
- [ ] T038 [US4] Apply visual polish to Usuarios, Sugestoes, Manual de uso and Configuracoes screens while preserving permission behavior, audit/history visibility and current controls
- [ ] T039 [US4] Apply visual polish to client portal shell and representative portal screens while preserving client-only data scope and current actions
- [ ] T040 [US4] Validate representative internal and portal routes against `specs/006-site-design-refresh/contracts/internal-portal-visual-contract.md`

**Checkpoint**: Internal app and portal are visually aligned with the refreshed design language and protected behavior remains unchanged.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final visual QA, accessibility checks, performance checks and documentation updates.

- [ ] T041 [P] Run responsive visual QA from `specs/006-site-design-refresh/quickstart.md` and record findings in `specs/006-site-design-refresh/visual-qa.md`
- [ ] T042 [P] Check public pages for unsupported claims, invented metrics, misleading badges or unapproved testimonials in `src/pages/AboutPage.tsx`, `src/pages/HomePage.tsx`, and `src/pages/SolutionsPage.tsx`
- [ ] T043 [P] Review keyboard focus, link labels, button states and form labels across public, internal and portal representative screens
- [ ] T044 Review route bundle impact and avoid adding heavy new dependencies across public, internal and portal visual changes
- [ ] T045 Validate that protected menus, actions and data remain hidden from unauthorized roles and client users
- [ ] T046 Run `npm run lint` from repository root
- [ ] T047 Run `npm run test` from repository root
- [ ] T048 Run `npm run build` from repository root
- [ ] T049 Final manual smoke test for `/`, `/inicio`, `/sobre`, `/solucoes`, `/contato`, `/newsletter`, `/privacidade`, `/termos`, `/login`, internal modules and `/portal`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup completion and blocks all story implementation.
- **User Story 1 (Phase 3)**: Depends on Foundational; MVP scope.
- **User Story 2 (Phase 4)**: Depends on Foundational; can run after or alongside US1, but final CTA language should align with US1.
- **User Story 3 (Phase 5)**: Depends on US1 and US2 visual direction being stable.
- **User Story 4 (Phase 6)**: Depends on Foundational and should reuse the refreshed visual language without applying marketing composition to operational modules.
- **Polish (Phase 7)**: Depends on selected user stories being complete.

### User Story Dependencies

- **US1**: No dependency on other stories after foundation.
- **US2**: No functional dependency on US1, but should reuse foundation and CTA hierarchy.
- **US3**: Depends on the visual patterns established in US1 and US2.
- **US4**: Depends on foundation and must preserve protected behavior; can start after visual tokens are stable.

### Parallel Opportunities

- T002 and T003 can run in parallel during setup.
- T009 and T010 can run in parallel during foundation.
- T019, T020 and T021 can run in parallel because they affect separate pages.
- T026, T027 and T028 can run in parallel because they affect separate pages.
- T034, T035, T036, T037, T038 and T039 can run in parallel after T032 and T033 because they affect different protected modules.
- T041, T042 and T043 can run in parallel during polish.

---

## Parallel Example: User Story 2

```text
Task: "T019 [P] [US2] Redesign service/category cards and section rhythm in src/pages/SolutionsPage.tsx"
Task: "T020 [P] [US2] Redesign contact page layout, form presentation and contact information hierarchy in src/pages/ContactPage.tsx"
Task: "T021 [P] [US2] Redesign newsletter page hierarchy, signup area and content cards in src/pages/NewsletterPage.tsx"
```

## Parallel Example: User Story 3

```text
Task: "T026 [P] [US3] Align privacy page typography, spacing and legal content layout in src/pages/PrivacyPage.tsx"
Task: "T027 [P] [US3] Align terms page typography, spacing and legal content layout in src/pages/TermsPage.tsx"
Task: "T028 [P] [US3] Align public fallback/not-found presentation if needed in src/pages/NotFound.tsx"
```

## Parallel Example: User Story 4

```text
Task: "T034 [US4] Apply visual polish to Dashboard, Calendario and Tarefas/Kanban screens while preserving current data loading, filters, statuses and actions"
Task: "T035 [US4] Apply visual polish to Clientes, client detail tabs and client obligations/pending sections while preserving client scoping and existing actions"
Task: "T037 [US4] Apply visual polish to Relatorios, Financeiro and Obrigacoes screens while preserving previews, exports, uploads, routing previews, forms and save/send actions"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 for `/` and `/inicio`.
3. Validate first impression, CTA visibility, responsive behavior and absence of horizontal scroll.
4. Stop for stakeholder review if needed.

### Incremental Delivery

1. Foundation shell and visual tokens.
2. US1 home/institutional first impression.
3. US2 commercial pages and forms.
4. US3 consistency across legal/fallback pages.
5. US4 protected internal app and portal visual consistency.
6. Full visual QA and build validation.

### Safety Rules

- Do not modify protected route access, Supabase schema, RLS, Edge Functions, Storage, automations, integrations or portal/internal app behavior for this redesign.
- Do not add unsupported claims, fabricated metrics or generic trust badges.
- Do not add new heavy visual libraries.
- Preserve all existing public, internal and portal form/action behaviors and user feedback.
- Validate public routes separately from internal app and client portal because their UX goals differ.
