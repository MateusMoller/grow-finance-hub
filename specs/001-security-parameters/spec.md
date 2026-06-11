# Feature Specification: Parametros Gerais de Seguranca

**Feature Branch**: `001-security-parameters`

**Created**: 2026-06-10

**Status**: Draft

**Input**: User description: "Criar uma especificacao focada em estabelecer parametros de seguranca para o projeto Grow Finance Hub com Supabase, cobrindo banco/RLS, Auth, Storage, Backend/API/Edge Functions, Frontend, logs/auditoria, backups e operacao."

## Clarifications

### Session 2026-06-10

- Q: Qual deve ser o escopo de entrega desta feature de seguranca? -> A: Baseline auditavel: documentacao, inventario, matriz de controles, runbooks e identificacao de gaps.
- Q: Onde a baseline auditavel deve ser mantida inicialmente? -> A: Repositorio como fonte inicial, com matrizes e runbooks em `docs/security/`, versionados em Git.
- Q: Qual nivel de evidencia e obrigatorio na primeira rodada da baseline? -> A: Evidencia obrigatoria para riscos critico/alto; plano de revisao para riscos medio/baixo.
- Q: O que deve classificar um item como risco critico na baseline? -> A: Exposicao cross-tenant/cross-client possivel, service-role/segredo sem validacao forte, ou Storage privado acessivel indevidamente.
- Q: Qual prazo de revisao deve ser usado para riscos medio e baixo? -> A: 60 dias para riscos medios; 90 dias para riscos baixos.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Validar acesso seguro por papel, organizacao e cliente (Priority: P1)

Como socio, administrador ou responsavel tecnico da Grow, quero que todos os acessos a dados operacionais sejam protegidos por regras de papel, organizacao e cliente, para impedir que um usuario acesse dados de outra empresa, cliente ou area do sistema.

**Why this priority**: Esta e a camada central de protecao do produto. Sem ela, qualquer evolucao em portal, documentos, financeiro, obrigacoes ou integracoes pode expor dados sensiveis.

**Independent Test**: Pode ser testado tentando acessar, por usuarios com perfis diferentes, registros de outra organizacao, outro cliente, area interna pelo portal e dados de portal pelo app interno. O resultado esperado e bloqueio consistente mesmo quando o ID e alterado manualmente.

**Acceptance Scenarios**:

1. **Given** um usuario de portal vinculado a um cliente especifico, **When** ele tenta acessar dados de outro cliente alterando parametros de rota ou requisicao, **Then** o sistema bloqueia o acesso e nao retorna dados sensiveis.
2. **Given** um usuario interno com papel de departamento, **When** ele tenta executar acao restrita a administradores ou gestores, **Then** o sistema bloqueia a acao mesmo que a interface seja manipulada.
3. **Given** uma tabela operacional exposta a usuarios autenticados, **When** uma leitura, criacao, edicao ou exclusao e executada, **Then** a permissao considera papel, organizacao ativa, cliente alvo e status do vinculo.

---

### User Story 2 - Proteger documentos, storage e downloads sensiveis (Priority: P1)

Como cliente ou colaborador interno, quero enviar, visualizar e baixar documentos apenas quando autorizado, para garantir que arquivos fiscais, contabeis, financeiros, trabalhistas e cadastrais nao sejam expostos indevidamente.

**Why this priority**: Documentos sao uma das superficies de maior risco do produto, especialmente no portal, obrigacoes, DP, financeiro e integracoes automatizadas.

**Independent Test**: Pode ser testado enviando arquivos validos e invalidos, tentando baixar documentos sem vinculo autorizado, tentando acessar URL expirada e verificando se uploads/downloads relevantes aparecem em auditoria.

**Acceptance Scenarios**:

1. **Given** um bucket de documentos privados, **When** um usuario autorizado solicita download, **Then** o acesso e concedido por mecanismo temporario e restrito ao arquivo permitido.
2. **Given** um usuario sem vinculo com o cliente do documento, **When** ele tenta baixar ou listar arquivos desse cliente, **Then** nenhum arquivo ou metadado sensivel e retornado.
3. **Given** um upload com extensao ou tipo de conteudo proibido, **When** o usuario tenta enviar o arquivo, **Then** o sistema rejeita o upload com mensagem controlada.

---

### User Story 3 - Executar acoes sensiveis somente em backend confiavel (Priority: P1)

Como responsavel tecnico, quero que acoes com privilegio elevado, service role, secrets ou integracoes externas sejam executadas apenas por backend confiavel, para evitar exposicao de chaves e bypass de politicas de acesso.

**Why this priority**: Integracoes com OpenAI, WhatsApp, Acessorias, Open Finance, e-mails, webhooks, criacao de usuarios e alteracao de permissoes nao podem depender de validacao apenas no navegador.

**Independent Test**: Pode ser testado verificando que nenhuma chave sensivel existe no bundle do frontend e que cada acao privilegiada revalida usuario, papel, organizacao, cliente e payload antes de executar.

**Acceptance Scenarios**:

1. **Given** uma acao administrativa, **When** ela e solicitada pelo frontend, **Then** o backend revalida identidade, permissao, organizacao, escopo do recurso e formato do payload antes de executar.
2. **Given** uma integracao externa configurada com segredo, **When** o frontend carrega a aplicacao, **Then** nenhum segredo ou chave privada fica disponivel no navegador.
3. **Given** um webhook recebido, **When** o evento chega ao sistema, **Then** a origem, assinatura, idempotencia e formato sao validados antes de qualquer mudanca operacional.

---

### User Story 4 - Auditar acoes criticas e suportar resposta a incidentes (Priority: P2)

Como gestor ou responsavel de seguranca, quero rastrear acoes sensiveis por usuario, organizacao, cliente, entidade e horario, para investigar incidentes, recuperar contexto operacional e comprovar controles.

**Why this priority**: Auditoria reduz risco operacional e permite investigar acessos indevidos, alteracoes cadastrais, downloads, permissoes, automacoes e integracoes.

**Independent Test**: Pode ser testado executando acoes criticas e verificando se os registros de auditoria permitem identificar ator, escopo, entidade alterada, dados relevantes e origem da acao.

**Acceptance Scenarios**:

1. **Given** uma alteracao de permissao, **When** a acao e concluida, **Then** a auditoria registra ator, usuario afetado, organizacao, papel anterior, papel novo e horario.
2. **Given** um download de documento sensivel, **When** o arquivo e acessado, **Then** o evento registra usuario, cliente, documento, origem e horario.
3. **Given** uma falha em integracao sensivel, **When** o sistema rejeita ou interrompe a acao, **Then** o erro e registrado sem expor segredo, token ou conteudo sensivel em logs.

---

### User Story 5 - Operar com ambientes, backups e revisao de acesso (Priority: P2)

Como owner tecnico, quero parametros operacionais minimos para ambientes, backups, sessoes, MFA, rate limit e revisao de acessos, para reduzir risco de erro em producao e melhorar continuidade do negocio.

**Why this priority**: Seguranca depende tambem de operacao: ambientes separados, chaves distintas, rotacao, backup, rollback e revisao periodica de acessos.

**Independent Test**: Pode ser testado por checklist operacional: ambientes existentes, chaves separadas, backups ativos, processo de restauracao testado, MFA em perfis criticos e revisao de usuarios do painel.

**Acceptance Scenarios**:

1. **Given** uma nova regra de seguranca ou migration critica, **When** ela e preparada, **Then** deve existir validacao em ambiente de homologacao antes de producao.
2. **Given** um usuario interno com perfil critico, **When** ele acessa recursos administrativos, **Then** MFA, sessao e reautenticacao seguem politica definida para o perfil.
3. **Given** um incidente de chave vazada, **When** o plano de resposta e acionado, **Then** ha procedimento documentado para revogar, rotacionar e validar a remediacao.

### Edge Cases

- Tentativa de acesso horizontal por alteracao manual de `client_id`, `organization_id` ou ID de documento.
- Qualquer caminho que permita exposicao cross-tenant/cross-client possivel deve ser tratado como risco critico ate prova contraria.
- Usuario interno com multiplos papeis e organizacoes tentando operar fora da organizacao ativa.
- Usuario de portal vinculado a mais de um cliente selecionando cliente incorreto.
- URL assinada expirada ou reutilizada depois do prazo permitido.
- Arquivo com extensao permitida mas conteudo ou MIME incompatibil compativel com ataque.
- Webhook duplicado, atrasado, sem assinatura valida ou com evento externo ja processado.
- Funcao privilegiada chamada sem JWT, com JWT expirado ou com papel insuficiente.
- Policy ampla em tabela publica retornando dados internos por engano.
- Ambiente de staging usando chaves ou dados reais de producao.
- Log de erro contendo token, chave, conteudo de documento ou dado pessoal sensivel.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST manter separacao explicita entre site publico, app interno e portal do cliente em rotas, permissoes e dados retornados.
- **FR-002**: O sistema MUST exigir controle de acesso por papel para toda acao protegida, incluindo leitura, criacao, edicao, exclusao, upload, download, automacao e integracao.
- **FR-003**: O sistema MUST exigir escopo de organizacao para todo dado operacional sensivel ou multiempresa.
- **FR-004**: O sistema MUST exigir escopo de cliente para todo dado visivel no portal do cliente ou relacionado a documentos, financeiro, obrigacoes e solicitacoes.
- **FR-005**: O sistema MUST bloquear acesso a dados de outra organizacao ou cliente mesmo quando o usuario manipula IDs no navegador, rota, payload ou ferramenta externa.
- **FR-006**: O sistema MUST definir regras separadas para visualizar, criar, editar e excluir registros sensiveis.
- **FR-007**: O sistema MUST tratar service role, chaves privadas, tokens externos, segredos de webhook e chaves de IA como dados restritos ao backend confiavel.
- **FR-008**: O sistema MUST executar criacao de usuarios, alteracao de permissoes, integracoes externas, envio de e-mails, webhooks, acoes financeiras, relatorios sensiveis e rotinas administrativas em backend confiavel.
- **FR-009**: O sistema MUST validar no backend tipo, tamanho, formato, permissao, status do usuario, vinculo com organizacao, vinculo com cliente e limites de uso para acoes sensiveis.
- **FR-010**: O sistema MUST proteger buckets de documentos sensiveis como privados, permitindo acesso somente por autorizacao e acesso temporario quando aplicavel.
- **FR-011**: O sistema MUST limitar uploads por tamanho, tipo de conteudo e extensoes permitidas, bloqueando executaveis e arquivos de script.
- **FR-012**: O sistema MUST registrar auditoria de login relevante, falha de login, troca de senha, criacao de usuario, alteracao de permissao, upload, download, exclusao, geracao de relatorio, alteracao cadastral e acao com privilegio elevado.
- **FR-013**: O sistema MUST rejeitar webhooks sem origem, assinatura, idempotencia ou payload valido quando a acao puder alterar estado operacional.
- **FR-014**: O sistema MUST aplicar limites de uso para login, recuperacao de senha, OTP, upload, geracao de relatorio, convite de usuarios, APIs publicas e webhooks sensiveis.
- **FR-015**: O sistema MUST configurar sessoes e reautenticacao de forma mais restritiva para perfis administrativos, financeiros, internos e com acesso a documentos.
- **FR-016**: O sistema MUST exigir MFA para perfis administrativos, socios, equipe interna critica e usuarios com acesso financeiro, documental ou trabalhista sensivel.
- **FR-017**: O sistema MUST aceitar redirecionamentos de autenticacao somente para origens conhecidas e aprovadas por ambiente.
- **FR-018**: O sistema MUST impedir exposicao desnecessaria de dados sensiveis em respostas, relatorios, logs, telas e downloads.
- **FR-019**: O sistema MUST separar ou restringir dados altamente sensiveis quando acesso por linha nao for suficiente para proteger campos especificos.
- **FR-020**: O sistema MUST estabelecer ambientes separados para desenvolvimento, homologacao e producao, com chaves, banco e politicas de acesso independentes.
- **FR-021**: O sistema MUST manter migrations versionadas, backup automatico, estrategia de restauracao, plano de rollback e resposta a incidente para mudancas criticas.
- **FR-022**: O sistema MUST revisar periodicamente acessos ao painel administrativo, banco, deploy, secrets e ferramentas de terceiros.
- **FR-023**: A entrega inicial desta feature MUST produzir uma baseline auditavel com documentacao, inventario, matriz de controles, runbooks de validacao e identificacao de gaps antes de executar hardening amplo em runtime.
- **FR-024**: Correcoes reais em RLS, Storage, Edge Functions, headers, Auth ou operacao MUST ser planejadas a partir dos gaps priorizados na baseline, salvo risco critico identificado e aprovado para correcao imediata.
- **FR-025**: A baseline auditavel inicial MUST usar o repositorio como fonte de verdade, com matrizes, runbooks e evidencias em `docs/security/`, versionados em Git.
- **FR-026**: Persistencia da baseline em banco de dados MAY ser planejada futuramente, mas MUST NOT bloquear a primeira entrega de inventario e validacao.
- **FR-027**: Itens classificados como risco critico ou alto MUST ter evidencia obrigatoria na primeira rodada da baseline.
- **FR-028**: Itens classificados como risco medio ou baixo MUST ter ao menos plano de revisao, responsavel e criterio de validacao futura.
- **FR-029**: Um item MUST ser classificado como risco critico quando houver exposicao cross-tenant/cross-client possivel, uso de service-role ou segredo sem validacao forte, ou Storage privado acessivel indevidamente.
- **FR-030**: Itens classificados como risco medio MUST ter prazo de revisao em ate 60 dias; itens classificados como risco baixo MUST ter prazo de revisao em ate 90 dias.

### Security, Access & Tenant Requirements *(mandatory when data/auth is affected)*

- **SEC-001**: Affected surface MUST include internal app, client portal, Supabase database, Edge Functions, Storage, automations/webhooks, external integrations and operations. Public site is affected only for headers, CSP, CORS, public forms and absence of internal data.
- **SEC-002**: Required roles MUST be mapped for `admin`, `director`, `manager`, `employee`, `commercial`, `partner`, `departamento_pessoal`, `fiscal`, `contabil` and `client`, including blocked actions for each protected workflow.
- **SEC-003**: Organization and client boundaries MUST be specified for every read, write, upload, download, automation, webhook, report, AI action, WhatsApp action, Open Finance action and Acessorias action.
- **SEC-004**: Sensitive credentials and privileged operations MUST be handled only by backend/Edge Function code and never by browser-executed code.
- **SEC-005**: Operational changes MUST emit audit records sufficient to identify actor, organization, client, entity, action, timestamp and relevant before/after context.
- **SEC-006**: Data access rules MUST include separate authorization behavior for select, insert, update and delete.
- **SEC-007**: Storage access MUST distinguish public assets from private client, payroll, tax, financial and operational documents.
- **SEC-008**: Security headers, CSP, trusted redirect URLs and restricted CORS MUST be defined for deployed environments.
- **SEC-009**: Error handling MUST avoid exposing internal stack traces, secrets, tokens, document content, private payloads or unrestricted record identifiers.
- **SEC-010**: AI, WhatsApp and automation actions MUST classify risk and require confirmation or human review before medium or high impact operations.

### Scalability & Performance Requirements *(mandatory for high-volume flows)*

- **PERF-001**: Expected data volume MUST be documented for clients, documents, obligations, tasks, calendar events, audit logs, financial entries, CRM leads, webhook events and integration logs.
- **PERF-002**: Data loading MUST use bounded strategies such as pagination, server-side filtering, cached queries, background jobs or limited client-side work.
- **PERF-003**: High-volume screens MUST define primary filters and sorts before implementation to avoid unrestricted scans and expensive render paths.
- **PERF-004**: Audit and webhook records MUST support growth without blocking normal user workflows.
- **PERF-005**: Security checks MUST remain efficient enough that normal users can complete primary workflows without noticeable degradation.
- **PERF-006**: Backups, restores, log retention and document retention MUST be sized for production growth and incident response needs.

### Key Entities *(include if feature involves data)*

- **Organization**: Business tenant boundary used to separate operational data, settings, users, clients and integrations.
- **User Profile**: Authenticated person using the system, including internal users and client portal users.
- **Organization Member/User Role**: Relationship between user, organization, role and active status.
- **Client User**: Relationship that authorizes a portal user to access one or more clients.
- **Permission Policy**: Rule that defines which role can view, create, edit, delete or execute a protected action.
- **Private Document**: File and metadata scoped to organization, client, bucket, uploader, document type and retention state.
- **Audit Log**: Immutable or append-only record of sensitive action, actor, scope, entity and relevant before/after context.
- **Webhook Event**: External event record with provider, external event ID, payload metadata, processing status and idempotency state.
- **Security Configuration**: Environment-specific parameters for auth, session, MFA, redirect URLs, CORS, CSP, rate limits, backups and access reviews.
- **Incident Response Record**: Operational record for detected leaks, unauthorized access, failed restore, suspicious login or remediation activity.

### Data Classification *(include if feature involves data)*

- **Public**: Institutional pages, public newsletter content, public assets, public contact forms and non-sensitive marketing content.
- **Internal**: Operational tasks, calendar, CRM, reports, users, settings, audit views, internal chat, obligation management and administrative workflows.
- **Client Portal**: Client-scoped solicitations, messages, documents, obligations, financial summaries, forms and assistant interactions.
- **Sensitive/Regulated**: Financial data, fiscal data, labor/payroll data, identity data, document contents, bank data, secrets, tokens, service-role operations, AI context, WhatsApp messages, Open Finance data and Acessorias integration data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of protected user journeys identify required role, organization boundary, client boundary and allowed actions before implementation planning is approved.
- **SC-002**: 100% of tables, buckets and privileged actions identified as sensitive have documented read/create/update/delete or upload/download authorization behavior.
- **SC-003**: 0 known paths allow a portal user to retrieve data from an unauthorized client during validation scenarios.
- **SC-004**: 0 known paths expose service-role keys, private integration tokens or webhook secrets in browser-accessible code, logs or public assets.
- **SC-005**: 100% of medium-risk and high-risk AI, WhatsApp, financial, document or permission actions require confirmation, human review or another approved control.
- **SC-006**: At least 95% of critical security actions tested in the checklist produce an audit trail with actor, scope, entity, action and timestamp.
- **SC-007**: All private document downloads available to users expire within an approved short time window and cannot be reused outside the authorized context.
- **SC-008**: All new critical migrations include documented validation, rollback and production rollout notes before production use.
- **SC-009**: Security validation for the feature can be completed in staging before production without using production secrets in development.
- **SC-010**: Primary user workflows remain usable after security controls, with users able to complete login, authorized document access, authorized task access and authorized portal access without support intervention in at least 95% of validation runs.
- **SC-011**: A baseline auditavel exists with 100% of high-risk surfaces inventoried, owner layer assigned, required control listed and validation evidence path defined before broad runtime hardening begins.
- **SC-012**: All initial baseline artifacts are reviewable in Git under `docs/security/` without requiring a new database table or admin UI.
- **SC-013**: 100% of critical and high-risk inventory items have evidence paths and validation status recorded; 100% of medium and low-risk items have review owner and review criteria recorded.
- **SC-014**: 100% of medium-risk items have a review due date no later than 60 days and 100% of low-risk items have a review due date no later than 90 days.

## Assumptions

- The Grow Finance Hub remains a web application with public site, internal app and client portal surfaces.
- Supabase remains the primary backend for authentication, database, storage and Edge Functions.
- The current roles remain valid: `admin`, `director`, `manager`, `employee`, `commercial`, `partner`, `departamento_pessoal`, `fiscal`, `contabil` and `client`.
- The system continues moving toward organization-aware, tenant-ready operation with Grow as the default organization during transition.
- Existing legacy compatibility may remain temporarily, but new security rules prioritize the native Grow modules and tenant-aware model.
- Development, staging and production are expected to use separate credentials and separate operational controls.
- Some controls may require phased rollout, but the final security parameters must be documented before implementation begins.
- The first implementation increment prioritizes auditability and gap discovery over broad runtime changes.
- Initial security baseline artifacts are stored in repository documentation; database persistence is a later enhancement if operational review needs it.
