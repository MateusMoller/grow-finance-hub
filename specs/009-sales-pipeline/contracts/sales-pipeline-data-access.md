# Data Access Contract: Pipeline de Vendas Comercial

## Read Pipeline

**Actor**: Internal authenticated user with Vendas access.

**Inputs**:

- Active organization
- Optional filters: period, stage, status, owner, client, sale type, offer, source, search
- Pagination/cursor for list views

**Expected Result**:

- Opportunities scoped to active organization.
- Pipeline grouped by active and historical stages as needed.
- Metrics calculated from same filter scope.

**Failure Modes**:

- Unauthorized users receive controlled denial.
- Missing organization blocks read.

## Create Opportunity

**Actor**: Internal authenticated user with create/edit Vendas access.

**Inputs**:

- Existing client id or new lead fields
- Title
- Sale type/offer
- Optional "Outro" offer description
- Estimated value and recurrence
- Stage/status
- Responsible user
- Source, forecast and notes

**Expected Result**:

- Opportunity created in active organization.
- Duplicate warning returned or shown before final save when applicable.
- Creation event recorded.

**Failure Modes**:

- Invalid client/lead scope blocked.
- Missing required fields rejected.
- "Outro" without description rejected.

## Update Opportunity

**Actor**: Internal authenticated user with edit Vendas access.

**Inputs**:

- Opportunity id
- Changed fields

**Expected Result**:

- Opportunity updated only within active organization.
- Material changes recorded in event history.
- Metrics invalidated/refreshed.

**Failure Modes**:

- Cross-organization update blocked.
- Terminal-state restrictions enforced unless authorized reopen.

## Close Opportunity

**Actor**: Internal authenticated user with edit Vendas access.

**Inputs**:

- Opportunity id
- Result: won or lost
- Loss reason when lost
- Final value when changed

**Expected Result**:

- Opportunity leaves active pipeline.
- Result timestamp saved.
- Audit event recorded.
- If closing as won for a new-client opportunity, pending client and Commercial-sector completion task are created atomically.

**Failure Modes**:

- Lost without reason rejected.
- Unauthorized close blocked.
- Duplicate pending client or active completion task blocks duplicate creation and returns controlled result.

## Manage Pipeline Stages

**Actor**: Administrator or manager with Vendas access.

**Inputs**:

- Stage name
- Stage order
- Active/inactive state
- Terminal won/lost flags when applicable

**Expected Result**:

- Stage configuration updated within active organization.
- Historical opportunities retain inactive stages.
- Audit event recorded.

**Failure Modes**:

- Ordinary commercial users are blocked.
- Removing terminal meaning from stages used for won/lost metrics is rejected unless replacement is defined.

## Manage Commercial Catalog

**Actor**: Administrator or manager with Vendas access.

**Inputs**:

- Offer name
- Category
- Default value
- Default recurrence type
- Active/inactive state

**Expected Result**:

- Catalog item updated within active organization.
- Inactive offers remain available for historical display only.
- Audit event recorded.

**Failure Modes**:

- Ordinary commercial users are blocked.
- Duplicate active offer names in the same category are rejected or warned.

## Register Activity

**Actor**: Internal authenticated user with Vendas access.

**Inputs**:

- Opportunity id
- Activity type
- Description/title
- Optional due date

**Expected Result**:

- Activity added to opportunity timeline.
- Follow-up indicators refreshed.

**Failure Modes**:

- Invalid opportunity scope blocked.
- Empty activity rejected.
