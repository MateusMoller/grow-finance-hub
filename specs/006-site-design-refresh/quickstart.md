# Quickstart: Site Design Refresh

## 1. Confirm Scope

Review the spec and plan:

```powershell
Get-Content specs\006-site-design-refresh\spec.md
Get-Content specs\006-site-design-refresh\plan.md
```

Implementation should focus on:

- `src/components/site/*`
- existing protected app layout/navigation components
- existing client portal layout/navigation components
- `src/pages/AboutPage.tsx`
- `src/pages/HomePage.tsx`
- `src/pages/SolutionsPage.tsx`
- `src/pages/ContactPage.tsx`
- `src/pages/NewsletterPage.tsx`
- `src/pages/PrivacyPage.tsx`
- `src/pages/TermsPage.tsx`

Protected internal app and portal routes are in scope for visual changes only. Avoid changes to data loading, permissions, mutations, Supabase schema, Edge Functions, Storage, automations, integrations or business rules.

## 2. Run Local App

```powershell
npm run dev
```

Open public routes:

- `/`
- `/inicio`
- `/sobre`
- `/solucoes`
- `/contato`
- `/newsletter`
- `/privacidade`
- `/termos`

Open representative protected routes with a valid test session:

- Dashboard
- Calendario
- Tarefas
- Clientes and one client detail page
- CRM
- Chat Interno
- Relatorios
- Financeiro
- Obrigacoes
- Usuarios
- Notificacoes
- Configuracoes
- Client portal routes available to a client user

## 3. Visual QA Checklist

Review each route at:

- 390px mobile
- 768px tablet
- 1280px desktop
- 1536px wide desktop

Check:

- No horizontal scroll.
- No overlapping text, images, buttons or cards.
- Brand, offer and contact path visible quickly on the home/institutional route.
- Header and mobile navigation work.
- Footer links remain available.
- Forms remain usable.
- Login and portal links remain available.
- Privacy and terms links remain available.
- Design feels minimal, professional and secure.
- Internal modules preserve operational density and scanability.
- Tables, filters, toolbars, modals, forms and upload controls remain usable.
- Protected routes, menus and actions remain permission-safe.
- Client portal screens remain client-scoped.

## 4. Functional Smoke Tests

Verify without changing backend behavior:

- Navigation between public pages.
- Header links and mobile menu.
- Contact/lead form validation and submit behavior.
- Newsletter form validation and submit behavior.
- WhatsApp/contact shortcut behavior.
- Login redirect path.
- Portal redirect path.
- Internal module navigation, tabs, filters and table/list interactions.
- Existing save/edit/delete/export/upload/send buttons remain present and visually reachable.
- Existing loading, empty, error, success and permission states remain understandable.
- Client portal navigation and current client-visible actions.

## 5. Validation Commands

Run:

```powershell
npm run lint
npm run test
npm run build
```

If a command cannot run locally, record the limitation and continue with the available gates.

## 6. Completion Criteria

The feature is complete when:

- The visual contract passes on all affected public routes.
- The internal/portal visual contract passes on representative protected routes.
- Existing public functionality remains available.
- Existing internal and portal functionality remains available.
- Build and available tests pass.
- No protected app, portal or tenant behavior changed.
- Stakeholder review accepts the tone as professional, minimal and secure.
