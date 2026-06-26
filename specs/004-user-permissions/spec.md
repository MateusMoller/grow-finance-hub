# Feature Specification: User Permissions

**Feature Branch**: `004-user-permissions`

**Created**: 2026-06-23

**Status**: Implemented

**Input**: User description: "reformular o esquema de usuarios, e perissões, eu pensei nos usuarios serem divididos em 3 permissões, de Admin, colaborador e cliente, sendo Admin os usuarios com mais permissão e acesso ao controle de usuarios e todos os modulos, e inclusive podendo dar e tirar acesso aos modulos de cada colaborador, e cada colaborador deve ter um setor, que vai ser referente as tarefas que ele recebera em sua tela de tarefas, e as notifiações e tudo que esta agregado com o controle de tarefas do setor"

## Clarifications

### Session 2026-06-24

- Q: How should module access be assigned to existing colaboradores during migration? -> A: Preserve each user's equivalent current module access as explicit module grants.

### Session 2026-06-25

- Q: How should sectors be defined? -> A: Use a fixed list defined by the system.
- Q: What is the fixed sector list? -> A: Contábil, Fiscal, Departamento Pessoal, Financeiro, Comercial, Societário, and Geral.
- Q: Can a colaborador receive a task from another sector through direct assignment? -> A: Yes; colaboradores see tasks from their sector and tasks assigned directly to them.
- Q: How many companies may a cliente user access? -> A: One or more companies through explicit active client links.
- Q: What is the default module access for a new colaborador? -> A: Tasks only; all other modules require an explicit Admin grant.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin Manages Users And Access (Priority: P1)

An Admin can view all system users, classify each user as Admin, colaborador, or cliente, and manage which modules each colaborador can access. Admins always keep full access to all internal modules and user management.

**Why this priority**: This is the control layer for the entire product. Without it, permissions remain inconsistent and access cannot be governed safely.

**Independent Test**: Can be fully tested by signing in as an Admin, creating or editing users, assigning roles, changing module access for a colaborador, and verifying that the edited user sees only the allowed areas.

**Acceptance Scenarios**:

1. **Given** an Admin is authenticated, **When** they open user management, **Then** they can see all users with role, status, linked client when applicable, sector when applicable, and enabled module access.
2. **Given** an Admin edits a colaborador, **When** they enable or disable access to one or more modules, **Then** the colaborador's navigation, screens, and protected actions reflect the new access on the next session refresh or re-entry.
3. **Given** an Admin edits another Admin, **When** they save the user, **Then** the target user keeps access to all internal modules and user management.
4. **Given** a non-Admin user attempts to access user management, **When** they navigate directly to the area, **Then** access is denied and no user list or permission data is exposed.
5. **Given** an Admin creates a colaborador without selecting additional modules, **When** the account becomes active, **Then** the colaborador receives access to the Tasks module only.

---

### User Story 2 - Colaborador Works By Sector (Priority: P2)

A colaborador has exactly one assigned sector that determines their default task scope, notifications, workflows, and operational views. A direct task assignment to the colaborador grants access to that task even when it belongs to another sector.

**Why this priority**: Sector-based routing is central to task ownership, operational focus, and notification relevance.

**Independent Test**: Can be tested by assigning a colaborador to a sector, creating tasks for multiple sectors, and verifying that the colaborador sees and receives only the task information related to their sector and explicit permissions.

**Acceptance Scenarios**:

1. **Given** a colaborador belongs to the Fiscal sector, **When** they open the task area, **Then** they see Fiscal tasks plus tasks assigned directly to them and do not see other tasks from unrelated sectors.
2. **Given** a task is created for the colaborador's sector, **When** the system sends or displays task notifications, **Then** the colaborador receives or sees the notification according to the task notification rules.
3. **Given** an Admin changes a colaborador's sector, **When** the colaborador re-enters task-related areas, **Then** the visible task queue and future task notifications follow the new sector.
4. **Given** a colaborador has no sector assigned, **When** an Admin attempts to activate or save that colaborador, **Then** the system prevents the active colaborador configuration until a sector is chosen.
5. **Given** a task from another sector is assigned directly to a colaborador, **When** they open the task area or receive task notifications, **Then** they can access and receive notifications for that task without gaining access to the other sector's remaining tasks.

---

### User Story 3 - Cliente Accesses Only Client Scope (Priority: P3)

A cliente user can access only client-facing areas and data from one or more companies explicitly linked to their account through active client links.

**Why this priority**: Client users must be separated from internal operations to protect sensitive company, task, and user-management data.

**Independent Test**: Can be tested by linking a cliente user to one client account, signing in as that user, and confirming they can access only their permitted client portal information and cannot access internal modules.

**Acceptance Scenarios**:

1. **Given** a cliente user is linked to one or more client accounts, **When** they sign in, **Then** they only see client-facing areas and data for those linked clients.
2. **Given** a cliente user attempts to access internal modules, user management, task management, or Admin-only data, **When** they navigate directly or indirectly, **Then** access is denied.
3. **Given** a cliente user is not linked to any active client account, **When** they sign in, **Then** they see a safe blocked or pending-access state without exposing internal data.
4. **Given** a cliente user has multiple active client links, **When** they change the selected company, **Then** all client-facing data is scoped to the selected linked company.

---

### User Story 4 - Access Changes Are Auditable (Priority: P4)

Admins and business owners can review who changed user roles, module access, sector assignment, and client links, including when the change happened and what changed.

**Why this priority**: Permission changes affect security and operational accountability.

**Independent Test**: Can be tested by changing a user's role, sector, and module access, then reviewing an audit trail that identifies the actor, target user, timestamp, and changed fields.

**Acceptance Scenarios**:

1. **Given** an Admin changes a user's role, **When** the change is saved, **Then** the system records who made the change, the target user, the previous value, the new value, and the time.
2. **Given** an Admin changes a colaborador's module access or sector, **When** the change is saved, **Then** the audit record identifies the changed permissions and sector.
3. **Given** an Admin reviews user history, **When** they filter by a user, **Then** they can see permission-related changes for that user in chronological order.

### Edge Cases

- If the last active Admin would be demoted, deactivated, or lose Admin privileges, the system must block the change and explain that at least one active Admin is required.
- If a user has multiple historical role records, the system must use one current effective role and prevent ambiguous active-role states.
- If a colaborador loses access to a module while they are using it, the next protected navigation or action must deny access without exposing additional data.
- If a colaborador changes sector, tasks already completed remain historically attributed, while open task visibility follows the current sector rules.
- If a directly assigned task belongs to another sector, the assignment grants access only to that task and does not expose the sector's other tasks.
- If a cliente has multiple client links, inactive or removed links must immediately stop granting access while the remaining active links continue to work.
- If a user's account is inactive, suspended, or deleted, they must not receive task notifications or access protected data.
- If a module is disabled for a colaborador, hidden navigation alone is not sufficient; direct access to that module must also be denied.
- If an existing user's effective module access cannot be determined during migration, the account must be flagged for Admin review and must not silently receive broader access.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST support exactly three primary user roles for this feature: Admin, colaborador, and cliente.
- **FR-002**: The system MUST grant Admin users access to all internal modules, all user-management capabilities, and all module-access controls.
- **FR-003**: The system MUST allow Admin users to create, view, edit, activate, deactivate, and classify users by role.
- **FR-004**: The system MUST allow Admin users to grant or revoke module access for each colaborador.
- **FR-005**: The system MUST prevent non-Admin users from viewing or changing user roles, module access, sector assignment, or client-user links.
- **FR-006**: The system MUST require every active colaborador to have one assigned sector.
- **FR-007**: The system MUST use a colaborador's sector to determine the default tasks, task notifications, and task-related operational views available to that colaborador.
- **FR-008**: The system MUST allow Admin users to change a colaborador's assigned sector.
- **FR-009**: The system MUST apply sector changes to future task routing, future notifications, and current task views without changing completed task history.
- **FR-010**: The system MUST limit cliente users to client-facing areas and data for their explicitly linked client account or accounts.
- **FR-011**: The system MUST show a safe pending or blocked state for cliente users without an active client link.
- **FR-012**: The system MUST deny direct access attempts when a user tries to access a module, data area, or protected action outside their role, sector, client link, or module permissions.
- **FR-013**: The system MUST display each user's current role, status, sector when applicable, linked client when applicable, and enabled module access in user management.
- **FR-014**: The system MUST prevent removal, demotion, or deactivation of the final active Admin account.
- **FR-015**: The system MUST record audit entries for changes to role, status, module access, sector, and client links.
- **FR-016**: The system MUST make permission changes effective no later than the user's next session refresh, screen reload, or protected action.
- **FR-017**: The system MUST provide clear user-facing messages when access is denied, missing, or pending configuration.
- **FR-018**: The system MUST preserve existing task, notification, and client-portal behavior unless it conflicts with the new role, module-access, sector, or client-scope rules.
- **FR-019**: During migration, the system MUST translate each existing internal user's currently effective module access into equivalent explicit module grants when the user becomes a colaborador.
- **FR-020**: The system MUST restrict sector assignment to a fixed system-defined list and MUST NOT allow users, including Admins, to create, rename, or deactivate sectors through the application.
- **FR-021**: The fixed sector list MUST contain exactly: Contábil, Fiscal, Departamento Pessoal, Financeiro, Comercial, Societário, and Geral.
- **FR-022**: The system MUST allow a colaborador to access and receive notifications for tasks assigned directly to them regardless of task sector, without granting access to other tasks from that sector.
- **FR-023**: The system MUST allow a cliente user to have one or more explicit active client links and MUST scope every client-facing query and action to clients covered by those links.
- **FR-024**: The system MUST grant new colaboradores access to the Tasks module by default and MUST require an explicit Admin grant for every other internal module.

### Security, Access & Tenant Requirements *(mandatory when data/auth is affected)*

- **SEC-001**: Affected surfaces include the internal app, client portal, user-management area, task workflows, notifications, module navigation, protected operational data, and audit records.
- **SEC-002**: Admin users are required for user management, role changes, module-access changes, sector assignment, and client-user linking; colaboradores and clientes are blocked from these actions.
- **SEC-003**: Admin users may access all internal organization data; colaboradores may access only allowed modules and sector-relevant task flows; clientes may access only explicitly linked client data.
- **SEC-004**: Permission checks must apply to both visible navigation and direct protected actions so hidden menu items are not the only access control.
- **SEC-005**: Privileged operations such as changing roles, module access, sector assignment, and client links must be executed only after confirming the acting user has Admin privileges.
- **SEC-006**: The system must record audit entries for role, status, module access, sector, and client-link changes, including actor, target user, timestamp, previous value, and new value.
- **SEC-007**: Client users must never see internal task queues, internal user lists, internal module configuration, cross-client data, or Admin-only controls.
- **SEC-008**: Inactive or suspended users must be denied protected access and excluded from task-notification delivery.

### Scalability & Performance Requirements *(mandatory for high-volume flows)*

- **PERF-001**: User-management lists must support at least 500 users with filtering by role, sector, status, linked client, and module access.
- **PERF-002**: Task views for colaboradores must support at least 2,000 open tasks per organization while allowing sector-based filtering without forcing users to manually scan unrelated sectors.
- **PERF-003**: Permission and sector changes must be reflected in user-facing navigation and protected task/module access within 60 seconds or by the next screen reload, whichever happens first.
- **PERF-004**: Admins must be able to find and update a user's role, sector, or module access in under 2 minutes in normal operating conditions.
- **PERF-005**: Permission checks must not add noticeable delay to opening common modules, task lists, or client portal pages for typical users.

### Key Entities *(include if feature involves data)*

- **User**: A person with access credentials and profile information, current status, and one primary role: Admin, colaborador, or cliente.
- **Role**: The primary permission category that defines broad access boundaries and protected actions.
- **Module Access**: The set of internal modules a colaborador can open and use.
- **Sector**: One of Contábil, Fiscal, Departamento Pessoal, Financeiro, Comercial, Societário, or Geral, assigned to a colaborador and used for task routing and task notifications.
- **Client Link**: An explicit relationship between a cliente user and a client account; a cliente may have multiple links, and only active links grant access.
- **Task Routing Rule**: The rule that grants task visibility and notifications through the colaborador's sector by default or through direct assignment for an individual task.
- **Permission Audit Entry**: A record of a permission-related change, including actor, target user, changed field, previous value, new value, and timestamp.

### Data Classification *(include if feature involves data)*

- **Public**: No public-site data is introduced by this feature.
- **Internal**: User profiles, roles, module access, sectors, task routing, task views, notification routing, and audit records.
- **Client Portal**: Client-scoped user identity, client link, and client-facing data visible only to linked cliente users.
- **Sensitive/Regulated**: Identity information, role and permission assignments, client relationships, operational tasks, fiscal/labor/client documents indirectly exposed through modules, and audit history.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Admins can create or update a user's role, sector, and module access in under 2 minutes for 90% of tested cases.
- **SC-002**: 100% of non-Admin attempts to access user-management screens or permission-changing actions are denied during acceptance testing.
- **SC-003**: 100% of active colaboradores in production have exactly one assigned sector after migration and validation.
- **SC-004**: At least 95% of colaborador task-list checks show only tasks relevant to the user's sector and allowed modules during acceptance testing.
- **SC-005**: 100% of cliente users tested can access only their linked client data and cannot access internal modules.
- **SC-006**: 100% of role, module-access, sector, status, and client-link changes create an audit entry during acceptance testing.
- **SC-007**: Admin support requests related to "wrong task queue", "wrong module access", or "client user sees wrong area" decrease by at least 50% within 60 days of release.
- **SC-008**: Permission changes become visible to the affected user within 60 seconds or after the next screen reload in 95% of tested cases.

## Assumptions

- The feature reuses the existing authentication entry points and focuses on authorization, user classification, module access, sector routing, and auditability.
- Admin, colaborador, and cliente are the only primary roles in scope for the first release of this reformulation.
- Admin access is all-or-nothing for internal modules and cannot be selectively reduced by another Admin in this first release.
- A colaborador belongs to one primary sector at a time; multi-sector collaborators are out of scope for the first release unless represented by Admin-controlled module access plus a single primary sector.
- New colaboradores receive the Tasks module by default; access to every other internal module starts disabled until explicitly granted by an Admin.
- Cliente users may be linked to one or more companies, use client-facing areas only, and do not receive internal task queues or internal notifications.
- Existing users will need to be migrated or reviewed so each active user has one valid role and each active colaborador has one sector; each migrated colaborador retains equivalent current module access through explicit module grants.
- The sector list is fixed as Contábil, Fiscal, Departamento Pessoal, Financeiro, Comercial, Societário, and Geral; changing these values requires a controlled application and data-model change rather than an Admin action.
- Module access controls apply to internal modules; client portal access is controlled by the cliente role and client link.
- Existing task and notification concepts remain valid, but their visibility and delivery must respect the new role, sector, and module-access rules.
