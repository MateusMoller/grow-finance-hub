# Data Model: Site Design Refresh

This feature does not introduce database entities. The following conceptual entities define the visual design model and validation scope across public site, internal app and client portal.

## Public Page

**Represents**: A public route available without authentication.

**Examples**:

- Home/institutional route
- Services/solutions route
- Contact route
- Newsletter route
- Privacy and terms routes

**Key attributes**:

- Route path
- Primary purpose
- Primary call to action
- Secondary navigation/access links
- Required legal or contact information
- Responsive layout requirements

**Validation rules**:

- Must remain accessible without authentication.
- Must not expose internal, portal or client data.
- Must preserve existing user actions and navigation paths.
- Must be usable without horizontal scrolling on common mobile, tablet and desktop widths.

## Internal Module

**Represents**: A protected operational area available to authorized internal users.

**Examples**:

- Dashboard
- Clientes
- Tarefas
- Calendario
- CRM
- Relatorios
- Financeiro
- Obrigacoes
- Usuarios
- Notificacoes and Configuracoes

**Key attributes**:

- Route path
- Required role/module permission
- Primary operational purpose
- Lists, tables, filters, forms and actions
- Loading, empty, error, success and permission states
- Responsive layout requirements

**Validation rules**:

- Must remain protected by existing authentication and permission behavior.
- Must preserve current available actions, data visibility, filters, forms and validations.
- Must improve visual hierarchy without reducing operational density or hiding useful information.
- Must not change backend-owned business rules or tenant/client data scope.
- Must be usable without horizontal page overflow on common mobile, tablet and desktop widths.

## Client Portal Screen

**Represents**: A protected client-facing route limited to the authenticated client's allowed data.

**Examples**:

- Client portal dashboard
- Client documents/status views
- Client-scoped communication or action screens

**Key attributes**:

- Route path
- Client access scope
- Primary client action or information need
- Document/status/message components
- Loading, empty, error and success states
- Responsive layout requirements

**Validation rules**:

- Must remain protected by existing client access behavior.
- Must not expose internal-only or other-client data.
- Must preserve current client actions and data visibility.
- Must visually align with the Grow brand without changing portal rules or workflows.

## Visual Section

**Represents**: A bounded content area within a public page, internal module or portal screen.

**Examples**:

- First viewport/hero
- Services overview
- Trust or credibility block
- Process explanation
- Contact block
- Newsletter block
- Legal content section
- Operational toolbar
- Table or list region
- Form section
- Document upload/review section

**Key attributes**:

- Section purpose
- Heading and supporting copy
- Visual treatment
- Primary or secondary action
- Responsive behavior
- Accessibility expectations

**Validation rules**:

- Must have clear hierarchy and readable text.
- Must not rely on unsupported claims or invented metrics.
- Must avoid overlap, text clipping and excessive decoration.
- Must preserve the current brand palette foundation.
- In internal and portal contexts, must preserve operational clarity and useful density.

## Call to Action

**Represents**: A visible action that guides a visitor, internal user or portal user to the next intended step.

**Examples**:

- Contact action
- Newsletter subscription action
- Login/access action
- Portal access action
- WhatsApp/contact shortcut
- Save/edit/delete/export/send/upload actions
- Filter/search actions

**Key attributes**:

- Label
- Destination or form behavior
- Priority level
- Visual prominence
- Responsive placement

**Validation rules**:

- Must remain easy to find in its current context.
- Must not increase the number of steps required to reach contact or authenticated access.
- Must not increase the number of steps required to complete existing operational or portal workflows.
- Must use clear, non-misleading text.
- Must have an accessible focus and interaction state.

## Brand Style Element

**Represents**: A reusable visual treatment that creates consistency.

**Examples**:

- Typography scale
- Section spacing
- Button style
- Card style
- Form style
- Header and footer treatment
- Icon and imagery treatment

**Key attributes**:

- Usage context
- Tone
- Palette relationship
- Responsive constraints
- Interaction states

**Validation rules**:

- Must support a minimal, professional and secure tone.
- Must remain consistent across public pages, internal modules and portal screens.
- Must not degrade internal app or client portal usability.
- Must avoid new heavy dependencies unless separately justified.

## Visual QA Finding

**Represents**: A design review result captured during implementation validation.

**Key attributes**:

- Page
- Viewport
- Finding type
- Severity
- Expected outcome
- Actual outcome
- Resolution status

**Validation rules**:

- Blocking findings include overlap, clipped CTA, horizontal scroll, unreadable text, missing route, broken form action or hidden legal/access path.
- Non-blocking findings include minor spacing or polish issues that do not affect usability.
