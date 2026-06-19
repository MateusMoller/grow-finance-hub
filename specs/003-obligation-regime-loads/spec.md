# Feature Specification: Cargas Padrao de Obrigacoes por Regime Tributario

**Feature Branch**: `003-obligation-regime-loads`

**Created**: 2026-06-19

**Status**: Draft

**Input**: User description: "No modulo de obrigacoes, em catalogo de obrigacoes, estruturar como cargas padroes para os regimes tributarios, criar todas as principais obrigacoes de cada regime e separar por regime tributario, para que sempre que uma empresa nova for cadastrada e o regime tributario for selecionado, as obrigacoes da carga referente a este regime sejam vinculadas automaticamente. Deve ser possivel editar obrigacoes individualmente e criar novas obrigacoes para regimes tributarios. E muito importante nao duplicar obrigacoes; exemplo: usar a mesma obrigacao de FGTS para Simples Nacional, Lucro Presumido e Lucro Real."

## Clarifications

### Session 2026-06-19

- Q: Como obrigacoes condicionais da carga devem ser tratadas na aplicacao automatica? -> A: Aplicar obrigatorias e condicionais quando dados do cliente indicarem aplicabilidade; sem evidencia, marcar para revisao.
- Q: A aplicacao automatica da carga no cadastro deve gerar competencias iniciais automaticamente? -> A: Aplicar vinculos da carga no cadastro, mas gerar competencias apenas por acao existente/manual.
- Q: Como cargas padrao devem tratar filiais ou empresas vinculadas a uma matriz? -> A: Filiais recebem carga pelo proprio regime; se herdarem regime da matriz, aplicar com revisao.
- Q: Alteracoes futuras na carga padrao devem afetar clientes existentes do mesmo regime? -> A: Alteracoes na carga sao aplicadas automaticamente tambem aos clientes existentes.
- Q: A sincronizacao automatica de alteracoes na carga deve alterar competencias ja geradas? -> A: Sincronizar somente vinculos ativos/futuros; competencias ja geradas nao mudam.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Vincular carga ao cadastrar empresa (Priority: P1)

Um usuario interno cadastra uma nova empresa, seleciona o regime tributario e recebe automaticamente a carga padrao de obrigacoes daquele regime, sem precisar vincular uma por uma.

**Why this priority**: Este e o fluxo principal que reduz erro operacional, evita esquecimento de obrigacoes e padroniza o onboarding de clientes.

**Independent Test**: Cadastrar uma empresa com cada regime tributario suportado e confirmar que apenas as obrigacoes esperadas para o regime escolhido foram vinculadas uma unica vez ao cliente.

**Acceptance Scenarios**:

1. **Given** uma nova empresa sem obrigacoes vinculadas, **When** o usuario seleciona "Simples Nacional" no cadastro, **Then** a empresa recebe automaticamente a carga padrao ativa de Simples Nacional.
2. **Given** uma nova empresa com regime "Lucro Presumido", **When** o cadastro e salvo, **Then** o sistema vincula as obrigacoes padrao do Lucro Presumido sem duplicar obrigacoes compartilhadas como FGTS.
3. **Given** uma nova empresa com regime "Lucro Real", **When** o cadastro e salvo, **Then** o sistema cria os vinculos da carga de Lucro Real e registra quais obrigacoes vieram da carga padrao.
4. **Given** uma nova empresa com regime "MEI", **When** o cadastro e salvo, **Then** o sistema vincula apenas as obrigacoes aplicaveis ao MEI.
5. **Given** uma nova empresa recebeu vinculos da carga padrao, **When** o cadastro e concluido, **Then** nenhuma competencia inicial e gerada automaticamente ate que um usuario execute a acao existente de geracao de competencias.

---

### User Story 2 - Gerenciar cargas por regime (Priority: P1)

Um gestor do modulo de obrigacoes consulta, revisa e ajusta as cargas padrao por regime tributario, mantendo um catalogo mestre unico de obrigacoes.

**Why this priority**: A qualidade da automacao depende de cargas bem governadas, revisaveis e sem duplicidade entre regimes.

**Independent Test**: Abrir o catalogo de obrigacoes, alternar entre regimes, adicionar/remover obrigacoes da carga e confirmar que a mesma obrigacao mestre pode pertencer a varios regimes sem criar copias.

**Acceptance Scenarios**:

1. **Given** a obrigacao mestre "FGTS" ja existe, **When** o gestor inclui FGTS nas cargas de Simples Nacional, Lucro Presumido e Lucro Real, **Then** todos os regimes apontam para a mesma obrigacao mestre.
2. **Given** uma carga de regime esta em revisao, **When** o gestor altera obrigacoes daquela carga e publica a alteracao, **Then** clientes existentes e novos clientes do mesmo regime recebem a sincronizacao automatica preservando historico operacional.
3. **Given** uma obrigacao nova precisa ser aplicavel a um regime, **When** o gestor a cria no catalogo mestre e a adiciona a carga do regime, **Then** ela passa a aparecer na carga sem duplicar nome/codigo de obrigacao existente.

---

### User Story 3 - Editar obrigacoes individualmente por cliente (Priority: P1)

Um usuario interno ajusta as obrigacoes de uma empresa especifica depois da aplicacao da carga padrao, sem alterar indevidamente a carga global do regime.

**Why this priority**: Cada cliente pode ter particularidades fiscais, trabalhistas, estaduais, municipais ou operacionais que exigem excecoes controladas.

**Independent Test**: Aplicar uma carga padrao a um cliente, alterar vencimento, responsavel, vigencia ou remover/adicionar uma obrigacao apenas nesse cliente e confirmar que outros clientes do mesmo regime nao mudam.

**Acceptance Scenarios**:

1. **Given** uma empresa recebeu a carga padrao de Simples Nacional, **When** o usuario altera o vencimento tecnico de uma obrigacao no cliente, **Then** a alteracao vale apenas para aquele cliente.
2. **Given** uma empresa nao precisa de determinada obrigacao da carga, **When** o usuario inativa o vinculo individual, **Then** futuras competencias desse cliente deixam de ser geradas para essa obrigacao.
3. **Given** uma empresa precisa de uma obrigacao adicional, **When** o usuario vincula manualmente uma obrigacao do catalogo mestre, **Then** o vinculo e registrado como ajuste individual e nao como parte da carga padrao.

---

### User Story 4 - Prevenir e corrigir duplicidades (Priority: P2)

Um gestor identifica possiveis duplicidades no catalogo e nas cargas antes que obrigações repetidas sejam vinculadas a clientes ou gerem competencias duplicadas.

**Why this priority**: Duplicidades em obrigacoes geram retrabalho, prazos duplicados, documentos duplicados e risco de comunicacao incorreta ao cliente.

**Independent Test**: Tentar criar obrigacoes com mesmo codigo, nome normalizado ou finalidade equivalente e confirmar que o sistema bloqueia duplicidade ou orienta a reutilizar a obrigacao mestre existente.

**Acceptance Scenarios**:

1. **Given** a obrigacao "FGTS" ja existe no catalogo mestre, **When** o gestor tenta criar "F.G.T.S." ou "FGTS mensal", **Then** o sistema alerta sobre possivel duplicidade e oferece reutilizar a obrigacao existente.
2. **Given** uma empresa ja possui FGTS vinculado por carga, **When** uma nova carga ou ajuste manual tenta vincular FGTS novamente, **Then** o sistema mantem um unico vinculo ativo para a mesma obrigacao no cliente.
3. **Given** existem obrigacoes historicas duplicadas, **When** o gestor revisa o catalogo, **Then** o sistema permite identificar quais registros devem ser mantidos, mesclados ou desativados sem perder historico operacional.

---

### User Story 5 - Reaplicar carga em mudanca de regime (Priority: P2)

Um usuario interno altera o regime tributario de uma empresa existente e consegue revisar quais obrigacoes devem ser adicionadas, mantidas ou removidas.

**Why this priority**: Mudancas de regime sao frequentes em rotinas fiscais e nao podem gerar perda de historico ou mudancas silenciosas em obrigacoes ativas.

**Independent Test**: Alterar o regime de uma empresa com obrigacoes existentes, revisar a comparacao entre carga atual e nova carga e aplicar a mudanca confirmando que nao ha duplicidade nem remocao automatica sem confirmacao.

**Acceptance Scenarios**:

1. **Given** uma empresa esta em Simples Nacional, **When** o usuario altera o regime para Lucro Presumido, **Then** o sistema apresenta uma revisao com obrigacoes a adicionar, manter e sugerir inativacao.
2. **Given** uma obrigacao existe em ambos os regimes, **When** a carga nova e aplicada, **Then** o vinculo existente e mantido sem criar duplicata.
3. **Given** uma obrigacao so existia no regime antigo, **When** o usuario aplica a nova carga, **Then** o sistema exige confirmacao antes de inativar o vinculo individual do cliente.

### Edge Cases

- Empresa cadastrada sem regime tributario informado deve ficar sem carga aplicada e exibir pendencia operacional clara para revisao.
- Regime tributario desconhecido, escrito com variacao ou importado de integracao deve ser normalizado quando houver correspondencia segura; caso contrario, deve exigir revisao humana.
- Carga de regime vazia, inativa ou em revisao nao deve vincular obrigacoes automaticamente sem aviso.
- Obrigacao condicional sem evidencia cadastral suficiente nao deve ser vinculada automaticamente; deve aparecer como item pendente de revisao na aplicacao da carga.
- Obrigacao compartilhada entre varios regimes deve existir uma unica vez no catalogo mestre, com multiplos vinculos de carga.
- Obrigacao inativa no catalogo mestre nao deve ser aplicada automaticamente a novos clientes, mesmo que ainda apareca em cargas historicas.
- Cliente com obrigacao manual ja vinculada nao deve receber duplicata quando uma carga for aplicada posteriormente.
- Aplicacao automatica de carga no cadastro nao deve criar competencias, tarefas ou eventos de calendario sem acao explicita de geracao.
- Alteracao publicada em carga padrao ativa deve sincronizar automaticamente clientes existentes do mesmo regime, com auditoria, resumo de impacto e preservacao de historico.
- Sincronizacao automatica de carga deve afetar somente vinculos ativos e futuros; competencias, tarefas, eventos de calendario, documentos e protocolos ja gerados nao devem ser alterados.
- Competencias ja geradas para obrigacoes antigas devem preservar historico, status, documentos e protocolos.
- Empresas filiais, grupos ou matrizes devem respeitar a regra operacional existente de vinculo por cliente/empresa, sem atravessar limites indevidos entre entidades.
- Filiais com regime tributario proprio devem receber carga pelo proprio regime; filiais que herdarem regime da matriz devem ter a carga aplicada como revisao pendente, nao como copia automatica da matriz.
- Usuarios sem permissao de gestao do catalogo nao devem conseguir alterar cargas padrao ou criar obrigacoes mestre.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST maintain a single master catalog of obligations, where each obligation has a stable identity reused across one or more tax regimes.
- **FR-002**: System MUST provide standard obligation loads grouped by tax regime, at minimum: Simples Nacional, Lucro Presumido, Lucro Real and MEI.
- **FR-003**: System MUST allow one master obligation to be linked to multiple regime loads without creating duplicate obligation records.
- **FR-004**: System MUST include the main recurring obligations expected for each supported regime, grouped by operational area such as fiscal, accounting, payroll, corporate and finance when applicable.
- **FR-005**: System MUST include shared payroll and employment obligations, such as FGTS, eSocial/DCTFWeb-related routines and payroll closing, as reusable master obligations that can be attached to multiple regimes.
- **FR-006**: System MUST include Simples Nacional obligations such as DAS/PGDAS-D, DEFIS, payroll obligations when applicable, municipal service tax routines when applicable, invoice/document routines and annual/cadastral review routines.
- **FR-007**: System MUST include Lucro Presumido obligations such as federal tax calculation routines, PIS/COFINS, IRPJ/CSLL, ISS/ICMS routines when applicable, DCTF/DCTFWeb-related routines, EFD/Sped obligations when applicable, accounting closing and payroll obligations.
- **FR-008**: System MUST include Lucro Real obligations such as IRPJ/CSLL real profit routines, PIS/COFINS non-cumulative routines, ECF/ECD/Sped-related obligations, DCTF/DCTFWeb-related routines, accounting closing, tax bookkeeping, payroll obligations and applicable state/municipal routines.
- **FR-009**: System MUST include MEI obligations such as DAS-MEI, annual declaration, invoice/document routines when applicable and controlled optional payroll obligations when the MEI has employee.
- **FR-010**: System MUST automatically apply the active standard load when a new company is created with a supported tax regime.
- **FR-010A**: System MUST automatically apply required load items and conditional load items only when available client data clearly indicates applicability; conditional items without sufficient evidence MUST be flagged for review instead of being linked automatically.
- **FR-010B**: System MUST NOT generate obligation competencies, tasks or calendar events as part of the automatic new-company load application; competency generation MUST remain a separate explicit action.
- **FR-011**: System MUST identify whether each client obligation link originated from a standard load, manual addition, regime migration or exception.
- **FR-012**: Users MUST be able to edit client-specific obligation settings without changing the master obligation or the regime load.
- **FR-013**: Users MUST be able to add or remove obligations from a specific client after the standard load has been applied.
- **FR-013A**: System MUST apply standard loads to branch companies using the branch's own tax regime when present; if the branch inherits the parent company's regime, the load MUST be applied through a review path before becoming active.
- **FR-014**: Authorized users MUST be able to create, edit, activate and deactivate master obligations.
- **FR-015**: Authorized users MUST be able to add and remove master obligations from regime loads.
- **FR-016**: System MUST prevent duplicate active client links for the same master obligation and same company.
- **FR-017**: System MUST prevent duplicate master obligations using at least stable code and normalized name checks, with a review path for suspected semantic duplicates.
- **FR-018**: System MUST show a clear regime-load preview before applying loads to an existing company or after a regime change.
- **FR-019**: System MUST require explicit confirmation before removing or inactivating client-specific obligations during regime migration.
- **FR-020**: System MUST preserve historical competencies, documents, status, protocols and audit trail when obligations are inactivated, replaced or moved between regimes.
- **FR-021**: System MUST allow a regime load to be marked as active, inactive or in review.
- **FR-022**: System MUST show counts and warnings for duplicate candidates, inactive obligations, missing regime loads and clients without regime.
- **FR-023**: System MUST provide a migration/review path for existing clients so their current obligations can be reconciled with the appropriate regime load without mass duplication.
- **FR-023A**: System MUST automatically synchronize published changes from an active standard load to existing clients of the same tax regime, recording impact summary, skipped items, warnings and audit metadata.
- **FR-023B**: System MUST limit automatic standard-load synchronization to active and future client-obligation links; already generated competencies, tasks, calendar events, documents and protocols MUST remain unchanged.
- **FR-024**: System MUST support searching and filtering obligations by regime, sector, periodicity, active status and duplicate-risk status.
- **FR-025**: System MUST record who created, changed, applied or reapplied a regime load and when the action occurred.

### Baseline Obligation Coverage

The first governed baseline MUST include at least the following master obligations, with applicability marked as required, optional or conditional according to the client profile, employees, activities, municipality, state registration and current fiscal review. Conditional obligations are applied automatically only when client data provides enough evidence for the condition; otherwise they remain in the review summary.

#### Shared master obligations reused across regimes

- FGTS
- eSocial payroll/event routines
- DCTFWeb and applicable MIT routines for federal debit declaration
- EFD-Reinf when the company has applicable events, retentions, services or distributions
- Payroll closing and payslip/payroll evidence routine when the company has employees
- INSS/third-party contribution review when applicable
- Municipal service invoice and ISS routine when applicable
- State tax routine for ICMS taxpayers when applicable
- Tax certificate/regularity review
- Client document request/checklist routine
- Accounting monthly closing routine when applicable
- Annual cadastral and fiscal review

#### Simples Nacional baseline load

- PGDAS-D/DAS monthly apuração and payment
- DEFIS annual declaration
- DAS complementary/adjustment review when applicable
- ISS/service invoice routine when applicable
- ICMS/state routine or DeSTDA-style state obligation when applicable
- eSocial, FGTS and DCTFWeb payroll routines when the company has employees
- EFD-Reinf when applicable
- Accounting/bookkeeping support routine when contracted or required
- Annual Simples Nacional option/status review

#### Lucro Presumido baseline load

- IRPJ and CSLL presumed profit apuração
- PIS and COFINS cumulative apuração
- DCTFWeb/MIT federal declaration routine
- EFD-Contribuicoes when applicable
- EFD-Reinf when applicable
- ECF annual filing
- ECD when required or contracted
- ISS/service invoice routine when applicable
- ICMS, EFD ICMS/IPI or state routine when applicable
- eSocial, FGTS and payroll closing routines when the company has employees
- Tax withholding review for IRRF, CSRF, INSS and ISS when applicable

#### Lucro Real baseline load

- IRPJ and CSLL real profit apuração, including estimated/monthly or quarterly control when applicable
- PIS and COFINS non-cumulative apuração
- DCTFWeb/MIT federal declaration routine
- EFD-Contribuicoes
- ECD accounting bookkeeping
- ECF annual filing
- EFD-Reinf when applicable
- EFD ICMS/IPI or state tax routine when applicable
- ISS/service invoice routine when applicable
- eSocial, FGTS and payroll closing routines when the company has employees
- Tax withholding review for IRRF, CSRF, INSS and ISS when applicable
- Lalur/Lacs and fiscal adjustment review

#### MEI baseline load

- DAS-MEI monthly payment
- DASN-SIMEI annual declaration
- MEI revenue/gross receipts support routine
- Invoice/service document routine when applicable
- Annual MEI status and limit review
- eSocial, FGTS and payroll routines only when the MEI has employee
- Migration alert when MEI profile indicates possible desenquadramento risk

The baseline MUST NOT create separate master obligations for the same recurring obligation by regime. For example, FGTS is one master obligation linked to multiple loads, not three separate FGTS records.

### Security, Access & Tenant Requirements *(mandatory when data/auth is affected)*

- **SEC-001**: Affected surface is the internal app, Supabase database, obligation backend/Edge Function, client/company registration flow, obligation catalog and operational obligation generation.
- **SEC-002**: Only authorized internal roles may manage master obligations and regime loads; blocked roles include client portal users and unauthenticated users.
- **SEC-003**: Internal users with operational permission may view and edit client-specific obligation links only within their organization and allowed operational scope.
- **SEC-004**: Automatic load application and deduplication MUST respect organization boundaries and MUST NOT link obligations across organizations.
- **SEC-005**: Client portal users MUST NOT manage regime loads, master obligations or automatic linking rules.
- **SEC-006**: Privileged bulk application, deduplication and migration of obligation loads MUST be performed by trusted backend behavior, not only by a client screen.
- **SEC-007**: All catalog, load, client-link and regime-migration changes MUST create audit records with actor, organization, company, affected obligation, source action and before/after summary.

### Scalability & Performance Requirements *(mandatory for high-volume flows)*

- **PERF-001**: The feature MUST support at least 500 master obligations, 20 regime/load variations and 10,000 client-obligation links per organization without making the catalog screen impractical to use.
- **PERF-002**: Catalog and load views MUST use bounded loading, filtering or pagination so users can search and manage obligations without loading unrelated high-volume operational history.
- **PERF-003**: Applying a standard load to a single new company MUST complete within 5 seconds for a load of up to 150 obligations.
- **PERF-004**: Reconciliation for an existing company MUST summarize add/keep/inactivate/duplicate-risk results within 10 seconds for up to 300 existing client-obligation links.
- **PERF-005**: Bulk review or migration of existing clients MUST be staged, resumable or otherwise bounded so it cannot block normal obligation execution.

### Key Entities *(include if feature involves data)*

- **Master Obligation**: Canonical obligation definition reused across regimes and clients. Key attributes include code, name, sector, periodicity, due rules, active status, document expectations, communication defaults and duplicate identity.
- **Tax Regime**: Supported company tax classification used to select a standard obligation load. Initial regimes are Simples Nacional, Lucro Presumido, Lucro Real and MEI.
- **Regime Obligation Load**: Versioned or reviewable set of master obligations assigned to a tax regime, with status, notes, owner and applicability rules.
- **Load Obligation Item**: Relationship between a regime load and a master obligation, including whether it is required, optional, conditional or inactive for the regime.
- **Company/Client Obligation Link**: Client-specific assignment of a master obligation, including source, start date, end date, overrides, active status and notes.
- **Regime Migration Review**: Comparison generated when applying or changing a regime load for an existing company, listing obligations to add, keep, inactivate or review for duplicates.
- **Audit Record**: Trace of catalog, load and client-link changes with actor, timestamp, organization and summarized change.

### Data Classification *(include if feature involves data)*

- **Public**: N/A. No unauthenticated public site content is affected.
- **Internal**: Master obligation catalog, regime loads, operational notes, company regime and client-obligation links.
- **Client Portal**: Resulting obligation status and documents may appear in client-scoped portal views only according to existing portal rules; regime-load management remains internal-only.
- **Sensitive/Regulated**: Fiscal, payroll, tax regime, compliance status, documents, protocols and audit records are regulated operational data and must remain tenant-scoped and role-controlled.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 95% of new company registrations with a supported regime receive the correct standard obligation load without manual obligation-by-obligation setup.
- **SC-002**: Applying a standard load to a new company creates zero duplicate active links for the same master obligation.
- **SC-003**: A gestor can review all obligations in a regime load and identify shared obligations across regimes in under 2 minutes.
- **SC-004**: At least the four supported regimes, Simples Nacional, Lucro Presumido, Lucro Real and MEI, have active baseline loads before release.
- **SC-005**: Reapplying or changing a regime produces an add/keep/inactivate/review summary before changes are committed in 100% of tested cases.
- **SC-006**: Existing competencies, documents and protocols remain accessible after obligation inactivation or regime migration in 100% of sampled historical records.
- **SC-007**: Duplicate creation attempts using same code or normalized name are blocked or flagged for review in 100% of tested cases.
- **SC-008**: Single-company load application completes within 5 seconds for loads up to 150 obligations.
- **SC-009**: Support requests related to missing initial obligations for new companies are reduced by at least 50% after adoption.

## Assumptions

- The initial release supports Simples Nacional, Lucro Presumido, Lucro Real and MEI because these regimes already appear in company registration flows.
- "Carga padrao" means a reusable regime-level set of obligation links, not copied obligation definitions.
- Shared obligations such as FGTS must be modeled as one master obligation reused by multiple regime loads.
- Existing client-specific obligation behavior remains valid and will be extended rather than replaced.
- Automatic linking should occur when a new company is created with a supported regime and should be available as an explicit action for existing companies.
- Published changes to active standard loads affect both future applications and existing clients of the same tax regime through automatic synchronization.
- The exact legal applicability of some obligations can vary by activity, municipality, state, employees and revenue. The baseline loads should mark such items as conditional or optional rather than blindly mandatory.
- Client portal visibility remains limited to the existing obligation/status/document surfaces and does not expose catalog administration.
