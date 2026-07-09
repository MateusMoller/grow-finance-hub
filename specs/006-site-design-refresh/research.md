# Research: Site Design Refresh

## Decision 1: Scope the redesign to public, internal and portal visual experience

**Decision**: Include the public marketing/institutional site, protected internal app and client portal in the visual redesign. Permissions, automations, database schema, integrations, business rules and operational behavior remain out of scope.

**Rationale**: The user explicitly wants the internal modules included, but only as a design change. The public site should communicate trust externally, while the internal app and portal should feel more polished and consistent without sacrificing operational density, speed, permissions or existing workflows.

**Alternatives considered**:

- Redesign only the public site: rejected because the user asked to include internal modules too.
- Redesign product behavior and data model together with visuals: rejected because it increases risk and violates the visual-only requirement.
- Create a separate landing-page-only redesign: rejected because the brand should feel consistent across public, internal and portal surfaces.

## Decision 2: Use restrained professional-services visual language

**Decision**: Use clean hierarchy, controlled density, high legibility, precise spacing, subtle elevation, sober surfaces and clear calls to action.

**Rationale**: Professional-services and accounting websites rely on credibility, clarity and trust. Current design references for accounting and professional-services sites emphasize clean layouts, easy navigation, responsive behavior, clear calls to action and credibility signals.

**References considered**:

- [TOA Global accounting website guidance](https://toaglobal.com/blog/best-practices-for-accounting-website-design/): clean professional layout, navigable menus and responsive design.
- [MITCO accounting guidance](https://mitco.tech/accounting-website-design-10-dos-and-donts/): trust-building through real people, credible imagery and avoiding generic stock-like presentation.
- [Elementor professional-services examples](https://elementor.com/blog/professional-services-website-examples/): trust, strategy, visual hierarchy and clear conversion paths.

**Alternatives considered**:

- Highly expressive marketing design with large decorative gradients and motion: rejected because it risks reducing the secure/professional tone.
- Dense dashboard-like design: rejected because the public site should sell trust and clarity, not operational density.

## Decision 2a: Use product-operations design language for internal modules

**Decision**: Internal and portal screens should use quieter, denser product UI patterns: stable navigation, compact controls, readable tables, clear filters, consistent forms, restrained surfaces and explicit states.

**Rationale**: Operational modules are used repeatedly by the team and clients. They need visual polish, but not marketing-style heroes, oversized cards or decorative layouts that reduce scanability or slow work.

**Alternatives considered**:

- Apply the same public landing-page composition to internal modules: rejected because it would harm operational density.
- Leave internal modules untouched: rejected because the updated scope requires visual consistency beyond the public site.

## Decision 3: Preserve palette while improving tonal system

**Decision**: Keep the current brand palette as the base, then refine its usage with calmer backgrounds, stronger contrast, consistent border colors, intentional accent usage and fewer competing colors.

**Rationale**: The user explicitly asked to maintain the current palette. A refreshed tonal system can improve perceived quality without changing brand recognition.

**Alternatives considered**:

- Full color rebrand: rejected because it conflicts with user direction.
- Keep current styling unchanged except minor spacing: rejected because it would not satisfy the requested visual improvement.

## Decision 4: Use approved content only for trust signals

**Decision**: Improve trust presentation through layout, clarity, process explanation, real contact information and existing approved content. Do not invent metrics, certifications, testimonials, badges or claims.

**Rationale**: Accounting and financial-service credibility depends on accuracy. Unsupported claims can reduce trust and create business/legal risk.

**Alternatives considered**:

- Add generic trust badges and impressive-looking statistics: rejected because the spec requires no misleading or unsupported claims.
- Remove all trust indicators: rejected because confidence-building is a central success criterion.

## Decision 5: Preserve existing routes, forms and access paths

**Decision**: Keep all public routes, form flows, newsletter subscription, lead capture behavior, login link, portal link, legal links and WhatsApp entry points available.

**Rationale**: The redesign must not harm functionality. The public site already has contact and newsletter flows that should continue working.

**Alternatives considered**:

- Replace forms with a new interaction model: rejected until there is a separate conversion-flow requirement.
- Hide login/portal access to simplify the visual design: rejected because access paths are part of existing functionality.

## Decision 6: Validate with responsive visual QA

**Decision**: Require manual browser review across desktop, tablet and mobile widths, checking no horizontal scroll, no overlapping text, preserved CTAs, visible legal links and clean public route loading.

**Rationale**: The requested improvement is visual. Automated build checks are necessary but not sufficient for design quality.

**Alternatives considered**:

- Build-only validation: rejected because visual regressions can pass build.
- Pixel-perfect fixed layouts: rejected because the site must remain responsive.
