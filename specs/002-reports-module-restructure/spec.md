# Feature Specification: Reestruturacao Profissional do Modulo de Relatorios

**Feature Branch**: `002-reports-module-restructure`

**Created**: 2026-06-11

**Status**: Draft

**Input**: User description: "crie uma spec para estruturar de forma robusta e segura o modulo de relatorios pois constantemente tenho tido problemas com ele, pegue a base do que seria ele e reestruture de forma profissional"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Gerar relatorios confiaveis com escopo correto (Priority: P1)

Como usuario interno autorizado da Grow, quero gerar relatorios operacionais com dados corretos, filtrados por empresa, competencia, organizacao e permissao, para tomar decisoes sem risco de exportar dados errados ou fora do meu escopo.

**Why this priority**: O modulo de relatorios concentra dados de clientes, cadastros, CRM, tarefas e equipe. Se a base, filtros ou permissoes estiverem incorretos, o modulo vira fonte de erro operacional e risco de exposicao.

**Independent Test**: Pode ser testado acessando o modulo com usuarios de papeis diferentes, selecionando bases e filtros existentes, comparando contagens e amostras com os registros de origem e confirmando que dados fora do escopo nao aparecem no preview nem no arquivo gerado.

**Acceptance Scenarios**:

1. **Given** um usuario interno autorizado com filtros globais de empresa e competencia ativos, **When** ele seleciona uma base de relatorio, **Then** o preview e a exportacao mostram apenas registros compativeis com esses filtros e com seu escopo autorizado.
2. **Given** um usuario sem permissao para uma base sensivel, **When** ele tenta visualizar ou exportar essa base, **Then** o sistema bloqueia o acesso antes de retornar dados ou metadados sensiveis.
3. **Given** uma base sem registros para os filtros atuais, **When** o usuario tenta gerar o relatorio, **Then** o sistema informa o estado vazio de forma clara e nao gera arquivo enganoso.

---

### User Story 2 - Montar modelos reutilizaveis e governados (Priority: P1)

Como gestor ou colaborador autorizado, quero salvar, editar, carregar e excluir modelos de relatorio com colunas validas e nomenclatura clara, para repetir rotinas mensais sem reconstruir o relatorio manualmente e sem quebrar quando campos mudarem.

**Why this priority**: O uso recorrente de relatorios depende de presets confiaveis. Modelos quebrados, duplicados ou sem validacao aumentam retrabalho e geram exportacoes inconsistentes.

**Independent Test**: Pode ser testado criando um modelo, recarregando a pagina, editando colunas, renomeando, gerando o arquivo e tentando carregar um modelo com coluna obsoleta ou sem permissao.

**Acceptance Scenarios**:

1. **Given** um usuario autorizado com uma selecao de colunas valida, **When** ele salva um modelo com nome unico para a base escolhida, **Then** o modelo fica disponivel para uso futuro com nome, base, colunas, ordem e data de atualizacao.
2. **Given** um modelo salvo que contem coluna removida, renomeada ou nao autorizada, **When** o usuario carrega o modelo, **Then** o sistema preserva as colunas validas, sinaliza as invalidas e impede exportacao silenciosamente incorreta.
3. **Given** dois usuarios internos distintos, **When** um deles salva ou altera seu modelo pessoal, **Then** o outro usuario nao perde seus modelos nem herda configuracoes sem compartilhamento explicito.

---

### User Story 3 - Exportar dados sensiveis com seguranca e rastreabilidade (Priority: P1)

Como administrador ou responsavel operacional, quero que exportacoes de relatorios respeitem classificacao de dados, limites de uso e auditoria, para reduzir vazamento de informacoes financeiras, fiscais, trabalhistas, cadastrais e internas.

**Why this priority**: Relatorios podem conter CNPJ, contatos, papeis de usuarios, dados cadastrais, informacoes de socios, pro-labore e indicadores sensiveis. Exportacao sem controle e uma superficie critica.

**Independent Test**: Pode ser testado gerando relatorios de baixa e alta sensibilidade, verificando exigencia de permissao adequada, registro de auditoria, mascaramento quando aplicavel, limites por volume e mensagens controladas em falhas.

**Acceptance Scenarios**:

1. **Given** uma base classificada como sensivel, **When** um usuario autorizado exporta dados, **Then** a acao registra quem exportou, qual base, quais filtros, quantidade de linhas, classificacao e horario.
2. **Given** uma coluna que contem segredo, credencial, token ou senha, **When** o catalogo de relatorios e avaliado, **Then** essa coluna nao fica disponivel para preview ou exportacao direta.
3. **Given** uma tentativa de exportar volume acima do limite permitido para o papel do usuario, **When** a solicitacao e feita, **Then** o sistema bloqueia, pede reducao de filtros ou exige fluxo aprovado.

---

### User Story 4 - Administrar catalogo de bases e campos de relatorio (Priority: P2)

Como responsavel tecnico ou gestor do modulo, quero um catalogo governado de bases, campos, descricoes, sensibilidade e origem dos dados, para que novas colunas e relatorios sejam adicionados com criterio e sem duplicar regra em telas isoladas.

**Why this priority**: O modulo atual mistura definicao de dados, labels, formatacao, agrupamento, preview e exportacao em um unico fluxo. Uma estrutura profissional precisa tornar o catalogo audivel e evolutivo.

**Independent Test**: Pode ser testado revisando cada base disponivel, suas colunas, classificacao, fonte de verdade, regra de permissao, formato de exibicao e comportamento quando a origem muda ou fica indisponivel.

**Acceptance Scenarios**:

1. **Given** uma nova base candidata a relatorio, **When** ela e cadastrada no catalogo, **Then** deve declarar publico-alvo, origem, filtros obrigatorios, colunas, classificacao, permissao minima e criterio de atualizacao.
2. **Given** uma coluna de alto risco, **When** ela e avaliada para inclusao, **Then** deve haver aprovacao explicita, justificativa de negocio e regra de exibicao ou mascaramento.
3. **Given** uma origem de dados indisponivel, **When** o usuario abre o modulo, **Then** o sistema indica qual base falhou sem invalidar bases independentes que continuam disponiveis.

---

### User Story 5 - Operar relatorios com desempenho previsivel (Priority: P2)

Como usuario frequente do modulo, quero que previews, buscas de colunas, filtros e exportacoes continuem responsivos mesmo com crescimento de clientes, tarefas e dados cadastrais, para usar relatorios como ferramenta diaria e nao como processo instavel.

**Why this priority**: Relatorios tendem a crescer em volume e complexidade. Carregamento indiscriminado, varreduras repetidas ou exportacoes grandes podem travar a experiencia e criar falhas intermitentes.

**Independent Test**: Pode ser testado com volumes representativos de producao, medindo tempo para abrir o modulo, aplicar filtros, buscar campos, renderizar preview e iniciar exportacao.

**Acceptance Scenarios**:

1. **Given** um conjunto grande de clientes, tarefas e dados cadastrais, **When** o usuario abre o modulo, **Then** ele consegue escolher uma base e ver feedback util sem aguardar o carregamento integral de tudo.
2. **Given** uma busca por coluna em uma base com muitos campos, **When** o usuario digita termos de busca, **Then** os resultados aparecem sem atrasos perceptiveis ou reorganizacoes confusas.
3. **Given** uma exportacao grande, **When** o usuario solicita o arquivo, **Then** o sistema informa progresso, limite, sucesso ou falha sem deixar o estado da tela ambíguo.

### Edge Cases

- Usuario tenta acessar relatorios internos usando rota ou payload manipulado.
- Usuario autorizado para tarefas nao necessariamente autorizado para dados cadastrais sensiveis de clientes.
- Filtros globais de empresa ou competencia vazios, invalidos ou divergentes da base escolhida.
- Modelo salvo referencia base inexistente, coluna removida, coluna sem permissao atual ou formato descontinuado.
- Duas bases independentes carregam com sucesso enquanto uma origem falha.
- Exportacao e solicitada com zero linhas, zero colunas ou colunas duplicadas.
- Colunas com acentos, nomes legados ou codificacao inconsistente precisam manter rotulo legivel.
- Dados cadastrais repetidos por periodo ou atualizacao precisam escolher valor correto e explicar divergencias relevantes.
- Dados sensiveis como senha, token, credencial, chave, conteudo documental ou segredo aparecem em origem de dados candidata.
- Usuario tenta exportar volume excessivo, muitas colunas ou relatorio repetidamente em curto intervalo.
- Geracao de arquivo falha depois de carregar dados, sem perda da configuracao montada pelo usuario.
- Relatorio salvo por um usuario excluido ou inativo precisa ter comportamento definido para retencao e auditoria.
- Cliente ou tarefa e alterado durante geracao do relatorio.
- Organizacao desativa o modulo de relatorios enquanto usuarios possuem modelos salvos.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST oferecer um catalogo de bases de relatorio com nome, descricao, publico-alvo, origem dos dados, filtros aplicaveis, colunas disponiveis, classificacao de dados e permissao minima.
- **FR-002**: O catalogo inicial MUST cobrir, no minimo, as bases atualmente existentes de Clientes, Leads e CRM, Tarefas e Equipe.
- **FR-003**: A base de Clientes MUST contemplar dados gerais e dados cadastrais relevantes, sem expor segredos, senhas, tokens ou credenciais.
- **FR-004**: O sistema MUST validar permissao antes de listar bases, campos, preview, contagem, modelos salvos e exportacoes.
- **FR-005**: O sistema MUST aplicar filtros de empresa, competencia, organizacao e cliente quando a base de dados suportar esses recortes.
- **FR-006**: O sistema MUST deixar claro para o usuario quais filtros estao aplicados em cada preview e exportacao.
- **FR-007**: O usuario MUST conseguir selecionar colunas, remover colunas, reordenar colunas e restaurar uma selecao padrao por base.
- **FR-008**: O sistema MUST impedir exportacao quando nao houver colunas selecionadas ou quando nenhuma linha atender aos filtros atuais.
- **FR-009**: O sistema MUST oferecer preview limitado e representativo antes da exportacao, com indicacao da quantidade total considerada para a base e filtros atuais.
- **FR-010**: O usuario autorizado MUST conseguir salvar, carregar, editar e excluir modelos pessoais de relatorio.
- **FR-011**: Modelos salvos MUST preservar base, nome, colunas, ordem, formato, dono, data de criacao e data de atualizacao.
- **FR-012**: O sistema MUST validar modelos salvos ao carregar, removendo ou bloqueando campos invalidos, obsoletos ou sem permissao e informando o usuario.
- **FR-013**: O sistema MUST impedir nomes duplicados de modelo para o mesmo dono e base, considerando normalizacao de caixa, acentos e espacos.
- **FR-014**: O sistema SHOULD permitir evolucao futura para modelos compartilhados por equipe ou organizacao, mas a primeira versao reestruturada MUST manter modelos pessoais como comportamento padrao.
- **FR-015**: O sistema MUST exportar relatorios em formato de planilha adequado para uso operacional.
- **FR-016**: Exportacoes MUST usar nomes de arquivo claros, contendo base, escopo ou modelo e data de geracao.
- **FR-017**: O sistema MUST registrar auditoria para exportacoes sensiveis e para alteracoes relevantes em modelos de relatorio.
- **FR-018**: O sistema MUST classificar bases e colunas por sensibilidade antes de permitir preview ou exportacao.
- **FR-019**: O sistema MUST bloquear, mascarar ou omitir campos classificados como segredo, credencial, token, senha ou dado que nao tenha justificativa de relatorio.
- **FR-020**: O sistema MUST tratar falhas por base de forma isolada quando possivel, permitindo uso de bases independentes que carregaram corretamente.
- **FR-021**: Mensagens de erro MUST explicar a acao necessaria pelo usuario sem expor consulta interna, segredo, stack trace ou detalhes sensiveis.
- **FR-022**: O sistema MUST manter separacao entre modulo interno de relatorios e portal do cliente; dados internos nao podem aparecer no portal por reaproveitamento indevido.
- **FR-023**: O sistema MUST documentar criterio de propriedade da regra para catalogo, permissao, filtros, exportacao, auditoria e limites de uso antes da implementacao.
- **FR-024**: O sistema MUST suportar desativacao do modulo por organizacao sem perder modelos salvos existentes.
- **FR-025**: O sistema MUST fornecer estados claros de carregamento, vazio, erro parcial, erro total, permissao negada, exportacao em andamento e exportacao concluida.
- **FR-026**: O sistema SHOULD permitir que novas bases sejam adicionadas sem duplicar regras de permissao, classificacao e formatacao em multiplas telas.
- **FR-027**: O sistema MUST evitar que dados de equipe e papeis sejam visiveis a usuarios internos sem permissao administrativa ou gerencial adequada.
- **FR-028**: O sistema MUST tratar dados com codificacao ou labels legados de forma legivel para o usuario final.

### Security, Access & Tenant Requirements *(mandatory when data/auth is affected)*

- **SEC-001**: Affected surface MUST include internal app, Supabase database, saved report persistence, report export flow, audit logs and organization feature flags.
- **SEC-002**: Public site MUST NOT expose internal report data, saved report metadata, employee data or client operational data.
- **SEC-003**: Client portal MUST NOT receive internal report datasets unless a future portal-specific report is explicitly specified with client-level authorization.
- **SEC-004**: Required roles MUST be specified per dataset and per sensitive column group, including at least administrator, director, manager, department roles and client role as blocked for internal reports.
- **SEC-005**: Organization boundaries MUST be enforced for every report read, preview, saved model operation and export.
- **SEC-006**: Client boundaries MUST be enforced whenever a dataset contains client-specific operational, cadastral, fiscal, labor, financial or document-related data.
- **SEC-007**: Saved report presets MUST be readable, editable and deletable only by their owner unless a future shared-model rule is explicitly approved.
- **SEC-008**: Export authorization MUST be revalidated at the moment of generation, not only when the screen is opened.
- **SEC-009**: Sensitive report export audit MUST include actor, organization, dataset, filters, selected column identifiers, row count, format, result and timestamp.
- **SEC-010**: Audit records MUST avoid storing full exported content, secrets, tokens, passwords or unnecessary personal data.
- **SEC-011**: Fields containing password, token, secret, credential, private key or equivalent MUST be excluded from direct report availability by default.
- **SEC-012**: High-sensitivity reports MUST support rate limits, volume limits or explicit approval rules before production use.
- **SEC-013**: Error handling MUST fail closed for permission uncertainty, invalid dataset, invalid column, invalid saved model or tenant ambiguity.
- **SEC-014**: Any backend-owned export or privileged report generation MUST validate user identity, role, organization, client scope, requested fields and requested filters.

### Scalability & Performance Requirements *(mandatory for high-volume flows)*

- **PERF-001**: Expected data volume MUST be documented for each initial dataset, including Clientes, Dados Cadastrais, Leads e CRM, Tarefas and Equipe.
- **PERF-002**: Each dataset MUST define primary filters, default sort, expected preview limit and maximum export threshold.
- **PERF-003**: Data loading MUST avoid requiring all datasets to finish before the user can interact with an independently available dataset.
- **PERF-004**: Search and grouping of columns MUST remain responsive with at least 500 available fields in a dataset.
- **PERF-005**: Preview MUST be bounded and MUST NOT render the full export volume in the browser.
- **PERF-006**: Export flow MUST define behavior for large result sets, including user feedback, limit handling and retry-safe failure messaging.
- **PERF-007**: Repeated reports and saved models SHOULD reuse cached or deduplicated data where safe for permissions and freshness.
- **PERF-008**: The module MUST avoid repeated expensive scans for selected columns, field lookup, grouping and row derivation when datasets become large.

### Key Entities *(include if feature involves data)*

- **Report Dataset**: Governed base available for reporting, such as Clients, CRM Leads, Tasks or Team, with origin, filters, permissions and sensitivity.
- **Report Field**: Selectable column with label, identifier, data type, formatter, source, sensitivity and authorization rule.
- **Report Filter**: User-visible and system-enforced scope such as organization, company, client, competence, period, status, sector or responsible person.
- **Report Preview**: Bounded sample of report rows shown before export, reflecting the same filters and permissions as generation.
- **Saved Report Model**: User-owned reusable configuration containing dataset, selected fields, field order, format and lifecycle metadata.
- **Report Export**: Generated file request and result, including dataset, filters, selected fields, row count, format and status.
- **Report Audit Event**: Trace of sensitive report generation or model change with actor, scope, action, classification and timestamp.
- **Data Classification Rule**: Rule that marks dataset or field as public, internal, client-scoped, sensitive, regulated or prohibited for reports.
- **Organization Feature Flag**: Organization-level setting that enables or disables the report module while preserving existing persisted configurations.

### Data Classification *(include if feature involves data)*

- **Public**: Public site marketing content is out of scope for this internal report module and must not be mixed into internal reporting unless explicitly approved as non-sensitive.
- **Internal**: Operational summaries, CRM origin metrics, task status, team membership, role metadata, report presets and module configuration.
- **Client Portal**: Client-facing report delivery is out of scope for this feature; any future portal report must be separately specified with client-scoped authorization.
- **Sensitive/Regulated**: CNPJ, contact data, fiscal data, labor/payroll signals, partner data, pro-labore, financial values, document-related status, user roles, audit metadata and any integration-derived client data.
- **Prohibited In Direct Reports**: Passwords, senha GOV, tokens, API keys, private credentials, webhook secrets, raw document content and any field whose business need has not been approved.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of initial report datasets have documented owner, purpose, permitted roles, filters, field list, data classification and source of truth before implementation planning is approved.
- **SC-002**: 100% of selectable fields in the initial catalog are classified as internal, sensitive, regulated or prohibited before release.
- **SC-003**: 0 prohibited fields are available for preview or export in validation scenarios.
- **SC-004**: 100% of report exports in validation apply the same filters and authorization rules shown in the preview.
- **SC-005**: 100% of sensitive exports produce an audit event with actor, dataset, filters, selected fields, row count, result and timestamp.
- **SC-006**: At least 95% of users in validation can create, save, reload and generate a personal report model without support intervention.
- **SC-007**: Loading failure in one dataset does not block use of another independent dataset in at least 90% of simulated partial-failure scenarios.
- **SC-008**: Users can identify active filters, selected dataset, selected columns and export eligibility within 10 seconds during usability validation.
- **SC-009**: Search over 500 report fields returns visible results or an empty state within 1 second in representative validation.
- **SC-010**: Preview renders no more than the approved preview limit while clearly communicating the total matching records or bounded count behavior.
- **SC-011**: Export requests above approved volume limits are blocked or routed to an approved flow in 100% of validation attempts.
- **SC-012**: Support or bug reports related to broken saved models, wrong filters or unclear export failures decrease by at least 60% after adoption of the restructured module.

## Assumptions

- The module remains an internal web app feature and is not a client portal reporting feature in this specification.
- The initial restructuring uses the current conceptual bases: Clientes, Leads e CRM, Tarefas and Equipe.
- Existing personal saved report behavior remains the default; shared organizational templates can be planned later.
- XLSX remains the required operational export format for the first restructured version.
- Sensitive fields require explicit catalog approval; fields resembling passwords, tokens or secrets are blocked by default.
- Organization-aware behavior is required even where legacy data still has transitional assumptions.
- The report module must align with the broader security baseline and must not bypass RLS, feature flags, role checks or audit expectations.
- Technical implementation details, including exact frontend structure, backend functions, tables and query strategy, will be decided in the planning phase.
