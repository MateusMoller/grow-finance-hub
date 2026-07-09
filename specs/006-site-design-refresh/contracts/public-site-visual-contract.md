# Public Site Visual Contract

This contract defines the acceptance expectations for the public-site redesign.

## Affected Public Routes

- `/`
- `/inicio`
- `/sobre`
- `/solucoes`
- `/contato`
- `/newsletter`
- `/privacidade`
- `/termos`
- Public fallback/not-found route when reached outside protected app context

## Route Contract

Each affected route must satisfy:

- Loads without authentication.
- Preserves all existing navigation links, form actions, contact paths, login path, portal path and legal links.
- Does not display protected internal, portal, client, financial, fiscal or operational data.
- Presents visible content hierarchy within the first viewport.
- Remains usable at mobile, tablet and desktop widths without horizontal scroll.
- Keeps text readable without zoom.
- Avoids overlapping elements, clipped buttons, hidden form controls and inaccessible navigation.

## Header Contract

The public header must satisfy:

- Brand remains visible and recognizable.
- Primary public navigation remains available on desktop.
- Mobile navigation remains available and keyboard/touch friendly.
- Login/access path remains available.
- Contact path remains available.
- Header behavior must not obscure first-section content or trap focus.

## Footer Contract

The public footer must satisfy:

- Contact information remains visible.
- Service and institutional links remain available.
- Newsletter subscription remains available if currently present.
- Privacy and terms links remain available.
- Layout remains readable on mobile without dense columns collapsing poorly.

## Form Contract

Public forms must satisfy:

- Existing required fields and behavior remain unchanged unless a later task explicitly approves copy-only improvements.
- Success and error feedback remains visible and understandable.
- Visual changes do not hide validation requirements.
- Submit buttons show a clear disabled/loading state when existing behavior supports it.

## Visual Style Contract

The redesign must satisfy:

- Uses the current Grow palette as the base.
- Introduces a consistent treatment for sections, cards, buttons, forms and links.
- Uses restrained motion and avoids heavy decorative effects.
- Avoids one-note color dominance and avoids overusing gradients.
- Uses real or brand-relevant imagery/assets where visual assets are needed.
- Does not invent trust claims, metrics, awards, certifications or testimonials.

## Visual QA Viewports

Minimum manual review widths:

- 390px mobile
- 768px tablet
- 1280px desktop
- 1536px wide desktop

## Blocking Failures

The redesign is not acceptable if any affected route has:

- Horizontal page scroll caused by layout overflow.
- Text or buttons overlapping.
- Primary CTA hidden or inaccessible.
- Navigation unavailable on mobile or desktop.
- Existing form action broken.
- Login, portal, contact, privacy or terms path removed.
- Unsupported claims added.
- Protected app or portal data shown publicly.
