# Feature Specification: Default Obligations by Tax Regime

**Feature Branch**: `007-default-obligations`

**Created**: 2026-07-10

**Status**: Draft

**Input**: User description: "Criar obrigações padrões por regime tributário para cada empresa cadastrada, aplicadas automaticamente conforme MEI, Simples Nacional, Lucro Presumido ou Lucro Real, mantendo a possibilidade de usuários criarem obrigações adicionais manualmente."

## Clarifications

### Session 2026-07-10

- Q: When a conditional default obligation lacks enough evidence at company registration, what should the system do? -> A: Ignore it until positive evidence exists.
- Q: When a company's tax regime changes, what should happen to prior regime default obligations? -> A: Automatically inactivate future default obligations from the prior regime and apply future defaults from the new regime without requiring confirmation.
- Q: Who can change system default obligations through the interface? -> A: Nobody; default obligation changes are technical maintenance only, while users may still create manual company obligations.
- Q: If a conditional obligation was skipped for lack of evidence and positive evidence is added later, how should it be applied? -> A: Automatically apply it when the company attribute is updated.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Apply default obligations on company registration (Priority: P1)

An internal user registers a company with a tax regime, and the system automatically assigns the default obligation set for that regime so the company starts with the correct generic compliance controls.

**Why this priority**: This is the core value of the feature. Without automatic assignment, users must remember and manually recreate the baseline for every new company.

**Independent Test**: Register one active company for each supported tax regime and verify that only that regime's default obligations are assigned to the new company.

**Acceptance Scenarios**:

1. **Given** an internal user is registering a MEI company, **When** the registration is completed with MEI as the tax regime, **Then** the company receives the MEI default obligations: PGMEI/DAS MEI, DASN-SIMEI, eSocial if it has employees, FGTS if it has employees, DCTFWeb/MIT if it has employees or retentions, ISS municipal if it provides services, municipal service declaration if required by the municipality, NFS-e/emission fiscal municipal if it provides services, gross revenue control, limit/disqualification review, and DeSTDA if it has state registration or the state requires it.
2. **Given** an internal user is registering a Simples Nacional company, **When** the registration is completed with Simples Nacional as the tax regime, **Then** the company receives the Simples Nacional default obligations: PGDAS-D, DEFIS, DCTFWeb/MIT if it has employees or retentions, eSocial if it has employees, FGTS if it has employees, EFD-Reinf if there are retentions or services, ISS municipal if it provides services, municipal service declaration if required by the municipality, NFS-e/emission fiscal municipal if it provides services, EFD ICMS/IPI if it is an ICMS/IPI taxpayer, DeSTDA if it has ICMS/ST/DIFAL/anticipation, DAS complementary review when applicable, annual Simples option review, generic state obligations by UF, and generic municipal obligations by municipality.
3. **Given** an internal user is registering a Lucro Presumido company, **When** the registration is completed with Lucro Presumido as the tax regime, **Then** the company receives the Lucro Presumido default obligations: DCTFWeb/MIT, EFD-Reinf, eSocial if it has employees, FGTS if it has employees, EFD-Contribuições when applicable, EFD ICMS/IPI if it is an ICMS/IPI taxpayer, ISS municipal if it provides services, municipal service declaration if required by the municipality, ECD when applicable, ECF, IRPJ/CSLL quarterly, PIS/COFINS cumulative, DIRBI if it uses tax benefits or incentives, generic state obligations by UF, and generic municipal obligations by municipality.
4. **Given** an internal user is registering a Lucro Real company, **When** the registration is completed with Lucro Real as the tax regime, **Then** the company receives the Lucro Real default obligations: DCTFWeb/MIT, EFD-Reinf, eSocial if it has employees, FGTS if it has employees, EFD-Contribuições, EFD ICMS/IPI if it is an ICMS/IPI taxpayer, ISS municipal if it provides services, municipal service declaration if required by the municipality, ECD, ECF, IRPJ/CSLL Lucro Real, PIS/COFINS non-cumulative, DIRBI if it uses tax benefits or incentives, generic state obligations by UF, and generic municipal obligations by municipality.

---

### User Story 2 - Keep manual obligations available (Priority: P2)

An internal user can create additional manual obligations for companies when the standard regime set is not enough, without changing the governed default catalog.

**Why this priority**: Default obligations reduce repetitive work, but accounting operations still need flexibility for special cases, local rules, and business decisions.

**Independent Test**: Create a manual obligation for a company that already has default obligations and verify the manual obligation is added without removing, duplicating, or modifying the defaults.

**Acceptance Scenarios**:

1. **Given** a company already has default obligations for its regime, **When** an internal user creates an additional manual obligation, **Then** the new obligation is linked to that company and the existing default obligations remain unchanged.
2. **Given** an internal user creates a manual obligation, **When** they choose to link it to selected companies, **Then** only the selected companies receive that manual obligation and no standard default definition is changed.

---

### User Story 3 - Update defaults when tax regime changes (Priority: P3)

An internal user changes a company's tax regime, and the system automatically aligns the company's future obligations with the new regime while preserving operational history.

**Why this priority**: Regime changes are less frequent than registration, but when they occur the obligation set must not remain inconsistent.

**Independent Test**: Change a company's regime from Simples Nacional to Lucro Presumido and verify that future Simples Nacional default obligations are inactivated, future Lucro Presumido defaults are applied automatically, and prior completed records remain available for history.

**Acceptance Scenarios**:

1. **Given** a company has default obligations from its current regime, **When** an internal user changes the company to a different supported tax regime, **Then** the system automatically inactivates future default obligations from the prior regime and applies the new regime's default obligations for future control.
2. **Given** the company has completed or historical obligations from the prior regime, **When** the new regime defaults are automatically applied, **Then** historical completed obligations remain available for audit and are not recreated as duplicates.

### Edge Cases

- If a company is registered without a supported tax regime, no default obligations are applied and the user is shown that the tax regime must be completed before defaults can be assigned.
- If default obligations are applied more than once to the same company and regime, the system must not create duplicate active obligations.
- If an obligation is conditional and the required company attribute is missing or inconclusive, the obligation is not applied and remains absent until positive evidence confirms it applies.
- If a skipped conditional obligation later receives positive evidence through a company attribute update, the system automatically applies that obligation for future control without requiring a separate manual action.
- If a company's tax regime changes, only future active default obligations from the prior regime are inactivated automatically; completed historical records remain unchanged.
- If a default obligation has been manually inactivated for a company, reapplying defaults must not reactivate it without a visible user decision.
- If a user creates a manual obligation with a name or code similar to a default obligation, the system must prevent or flag duplicate risk before saving.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST maintain a standard obligation catalog grouped by the supported tax regimes: MEI, Simples Nacional, Lucro Presumido, and Lucro Real.
- **FR-001a**: System MUST NOT expose user-interface actions to create, edit, delete, or reclassify system default obligation definitions; changes to default definitions are technical maintenance only.
- **FR-002**: System MUST apply the correct standard obligation set automatically when an active company is registered with a supported tax regime.
- **FR-003**: System MUST support conditional standard obligations based on generic company attributes, including employees, service provision, municipal requirement, state registration, ICMS/IPI taxpayer status, ICMS/ST/DIFAL/anticipation, retentions/services, ECD applicability, EFD-Contribuições applicability, and tax benefit/incentive usage.
- **FR-004**: System MUST exclude sector-specific obligations from the standard sets, including DMED, DIMOB, DOI, e-Financeira, construction-specific CNO/SERO, and other obligations driven primarily by line of business.
- **FR-005**: System MUST avoid duplicate active obligations when defaults are applied during registration, manual application, or regime change.
- **FR-006**: Users MUST be able to create additional manual obligations beyond the standard set.
- **FR-007**: Users MUST be able to link manual obligations to selected companies without changing standard obligation definitions for other companies.
- **FR-008**: System MUST preserve the source of each company obligation as standard regime load, manual obligation, regime migration, or exception.
- **FR-009**: System MUST skip conditional obligations that cannot be confidently applied due to missing company evidence and MUST automatically apply them for future control when positive evidence later becomes available through company attribute updates.
- **FR-010**: System MUST preserve historical completed obligations when a company changes tax regime or when defaults are reapplied.
- **FR-011**: System MUST allow future default obligation sets to be updated through controlled technical maintenance without deleting existing company history.
- **FR-012**: System MUST clearly show users which obligations were assigned automatically by regime and which were created manually.
- **FR-013**: System MUST automatically inactivate future active default obligations from the prior tax regime and apply future default obligations from the new tax regime when a supported company's tax regime changes.
- **FR-014**: System MUST evaluate affected conditional default obligations after relevant company attributes change, without requiring users to manually rerun default assignment.

### Security, Access & Tenant Requirements *(mandatory when data/auth is affected)*

- **SEC-001**: Affected surfaces are the internal app, Supabase database, Edge Function, calendar/task automation records, and obligation catalog data.
- **SEC-002**: No user role may manage system default obligation definitions through the application interface; internal authorized users may create manual company obligations and trigger/apply default assignment flows where allowed, while client portal users are blocked from these actions.
- **SEC-003**: Company obligations, default application results, conditional skip records, tasks, and calendar records must remain scoped to the user's active organization and must not cross organization boundaries.
- **SEC-004**: Privileged creation, synchronization, duplicate prevention, and regime-load application must be performed by trusted backend logic, not only by the user interface.
- **SEC-005**: The system must record audit information when defaults are applied, when a company regime changes, when conditional obligations are skipped for lack of evidence, and when manual obligations are created or linked.

### Scalability & Performance Requirements *(mandatory for high-volume flows)*

- **PERF-001**: The feature must support organizations with at least 2,000 active companies and at least 50 active obligation definitions without making company registration feel delayed.
- **PERF-002**: Default assignment must use bounded work during a single company registration and must avoid loading unrelated companies into the user's browser.
- **PERF-003**: Users should see the assigned default obligations for a newly registered company within 3 seconds after registration completes under normal operating conditions.
- **PERF-004**: Lists of obligations must remain searchable/filterable by company, regime, source, status, and obligation name as the catalog grows.

### Key Entities *(include if feature involves data)*

- **Standard Obligation**: A technically maintained master obligation definition that can be reused across companies and regimes. Key attributes include name, code, sector, periodicity, due rule, active state, and whether it is generic or conditional.
- **Tax Regime Default Set**: A governed grouping of standard obligations for MEI, Simples Nacional, Lucro Presumido, or Lucro Real. It defines required, optional, and conditional membership.
- **Company Obligation Link**: The relationship between a company and an obligation. It records whether the link came from defaults, manual creation, regime migration, or an exception.
- **Conditional Obligation Evidence**: Company attributes used to decide whether a conditional obligation should be active or skipped until positive evidence exists.
- **Manual Obligation**: An additional obligation created by a user to cover a non-standard need without changing the default set for every company.

### Data Classification *(include if feature involves data)*

- **Public**: N/A.
- **Internal**: Default catalog, tax regime default sets, company obligation links, conditional skip records, task/calendar synchronization state, and audit history.
- **Client Portal**: Only completed or published obligation documents already authorized for a specific client; this feature does not expand portal visibility.
- **Sensitive/Regulated**: Fiscal, labor, tax regime, company compliance, document, and operational audit data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of newly registered companies with a supported tax regime receive the correct default obligation set, excluding conditional obligations without positive evidence, within 3 seconds of registration completion.
- **SC-002**: Reapplying defaults to a company produces zero duplicate active obligation links in 100% of tested cases.
- **SC-003**: Internal users can create and link an additional manual obligation to a selected company in under 2 minutes.
- **SC-004**: At least 95% of companies with complete generic attributes receive all applicable required and conditional default obligations without manual correction, including after relevant attribute updates.
- **SC-005**: Regime changes preserve 100% of completed historical obligations while automatically aligning future default obligations with the new regime.

## Assumptions

- The default matrix is limited to generic obligations by tax regime and deliberately excludes obligations primarily driven by specific business sectors.
- Existing company registration captures or can later receive the attributes needed to decide common conditional obligations.
- If a conditional attribute is unknown at registration time, the system skips that conditional obligation until positive evidence exists, then applies it automatically after the relevant company attribute is updated.
- Existing internal authentication, organization scoping, audit practices, and obligation workflow concepts remain in force.
- Manual obligations are additive and do not replace or mutate the governed default regime sets.
