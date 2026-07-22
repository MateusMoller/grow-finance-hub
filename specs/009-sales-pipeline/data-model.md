# Data Model: Pipeline de Vendas Comercial

## Sales Opportunity

Represents a commercial negotiation in the pipeline.

**Fields**:

- `id`: unique identifier
- `organization_id`: owning organization
- `client_id`: optional existing client
- `lead_client_id`: optional commercial lead/new-client draft
- `title`: opportunity title
- `contact_name`: main contact for lead/opportunity
- `contact_email`: commercial contact email
- `contact_phone`: commercial contact phone
- `sale_type`: accounting_service, automation, consulting, system, other
- `offer_id`: optional product/service catalog item
- `other_offer_description`: required when offer selection is "Outro"
- `estimated_value`: estimated commercial value
- `recurrence_type`: one_time, monthly, annual, other
- `probability`: expected close probability
- `stage`: current pipeline stage label for compatibility
- `stage_id`: optional configured pipeline stage reference
- `status`: active, won, lost, archived
- `source`: origin of opportunity
- `expected_close_date`: close forecast
- `owner_user_id`: commercial responsible user
- `loss_reason`: required when status is lost
- `won_at`, `lost_at`, `archived_at`: terminal status timestamps
- `created_by`, `updated_by`, `created_at`, `updated_at`

**Validation Rules**:

- Must belong to exactly one organization.
- Must have either an existing client, a commercial lead/new-client draft, or minimum contact fields.
- Lost opportunities require loss reason.
- Won/lost opportunities must leave active pipeline.
- Estimated value may be zero/null, but UI must flag it as missing.
- "Outro" offer selection requires free offer description.

**State Transitions**:

- `active` -> `won`
- `active` -> `lost`
- `active` -> `archived`
- `won` -> `active` only by authorized re-open action
- `lost` -> `active` only by authorized re-open action

## Commercial Lead / New Client Draft

Represents a contact not yet fully consolidated as an operational client.

**Fields**:

- `id`
- `organization_id`
- `name`
- `legal_name`
- `cnpj`
- `contact_name`
- `email`
- `phone`
- `segment`
- `notes`
- `converted_client_id`
- `completion_task_id`: optional task created to complete client registration after a won opportunity
- `created_by`, `updated_by`, `created_at`, `updated_at`

**Validation Rules**:

- Name or contact name is required.
- Duplicate warning should compare CNPJ, email and phone against existing clients and leads.
- Conversion to client should preserve opportunity links.
- Won new-client opportunities create a pending client and one Commercial-sector completion task.

## Product / Service Offer

Represents a commercial offer sold by the team.

**Fields**:

- `id`
- `organization_id`
- `name`
- `category`: accounting_service, automation, consulting, system, other
- `description`
- `default_value`
- `default_recurrence_type`
- `is_active`
- `created_from_default`: identifies initial/default catalog entries
- `created_by`, `updated_by`, `created_at`, `updated_at`

**Validation Rules**:

- Name and category are required.
- Only administrators and managers can create, edit or deactivate catalog items.
- Inactive offers remain visible in historical opportunities but are hidden from default creation lists.
- Opportunities may use "Outro" with a free description without creating a catalog item.

## Pipeline Stage

Represents ordered commercial stages.

**Fields**:

- `id`
- `organization_id`
- `name`
- `position`
- `is_terminal_won`
- `is_terminal_lost`
- `is_active`
- `is_default`
- `created_by`, `updated_by`, `created_at`, `updated_at`

**Default Stages**:

- Oportunidade Nova
- Contato Iniciado
- Diagnostico
- Reuniao Agendada
- Proposta Enviada
- Negociacao
- Fechado Ganho
- Fechado Perdido

**Validation Rules**:

- Only administrators and managers can create, edit, reorder or deactivate stages.
- Inactive stages remain visible in historical opportunities but are hidden for new movements.
- Terminal won/lost stages must remain identifiable for metrics and close behavior.

## Commercial Activity

Represents notes, follow-ups, meetings and next steps for an opportunity.

**Fields**:

- `id`
- `organization_id`
- `opportunity_id`
- `activity_type`: note, call, meeting, proposal, follow_up, status_change
- `title`
- `description`
- `due_at`
- `completed_at`
- `created_by`
- `created_at`

**Validation Rules**:

- Activity must belong to the same organization as the opportunity.
- Follow-ups can be open or completed.

## Commercial Event / Audit

Represents immutable history of material changes.

**Fields**:

- `id`
- `organization_id`
- `opportunity_id`
- `actor_user_id`
- `action`
- `before`
- `after`
- `metadata`
- `created_at`

**Validation Rules**:

- Events are append-only for authenticated users.
- Must capture actor and organization whenever possible.
- Must cover stage/catalog management and automatic client/task creation.

## Client Completion Task

Represents the operational task automatically created when a won opportunity converts a new lead into a pending client.

**Fields**:

- `id`
- `organization_id`
- `client_id`
- `opportunity_id`
- `sector`: Comercial
- `title`: complementacao de cadastro
- `status`: active workflow status
- `created_by`
- `created_at`

**Validation Rules**:

- Must be created only once as an active task for the same client and purpose.
- Must not require an individual assignee.
- Must belong to the same organization as the opportunity and client.

## Relationships

- One organization has many opportunities, offers, stages, leads and events.
- One opportunity may link to one existing client or one commercial lead/new-client draft.
- One opportunity may link to one offer.
- One opportunity may use "Outro" and store a free offer description instead of an offer.
- One opportunity has many activities and events.
- One offer has many opportunities.
- One existing client can have many opportunities.
- One won new-client opportunity creates one pending client and at most one active client completion task.
