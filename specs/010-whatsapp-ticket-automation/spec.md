# Feature Specification: WhatsApp Ticket Automation

**Feature Branch**: `010-whatsapp-ticket-automation`

**Created**: 2026-07-22

**Status**: Draft

**Input**: User description: "Automacao de atendimento, criacao de tarefas e gestao de tickets via WhatsApp, com central de tickets, triagem, roteamento por contexto, chat da tarefa, SLA, auditoria e automacoes supervisionadas."

## Clarifications

### Session 2026-07-23

- Q: Como o cliente deve escolher empresa, ticket e acao no WhatsApp? -> A: Usar mensagens interativas oficiais do WhatsApp, como listas/botoes, para cliente escolher empresa, ticket e acao.
- Q: Novas solicitacoes podem criar tarefa/ticket automaticamente? -> A: Permitir criacao automatica de tarefa/ticket quando a confianca da classificacao for alta.
- Q: Qual limiar define alta confianca para criacao automatica? -> A: Alta confianca e 90% ou mais.
- Q: Como anexos internos da tarefa podem aparecer para o cliente? -> A: Anexos internos ficam privados por padrao e so aparecem ao cliente quando liberados explicitamente.
- Q: Qual deve ser a expiracao padrao do contexto ativo? -> A: Contexto ativo expira em 24 horas apos a ultima interacao.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cliente direciona mensagens para tickets existentes (Priority: P1)

Como cliente ou contato autorizado, quero visualizar meus tickets ativos no WhatsApp e escolher sobre qual atendimento estou falando, para que minhas mensagens e documentos entrem na tarefa correta sem depender de reinterpretacao manual.

**Why this priority**: Este e o fluxo central da feature: reduzir perda de contexto entre WhatsApp e tarefas e evitar que mensagens novas sejam tratadas como demandas soltas.

**Independent Test**: Pode ser testado com um cliente ativo que tenha pelo menos um ticket aberto, iniciando uma conversa, selecionando um ticket e enviando mensagem e arquivo; ambos devem aparecer no chat da tarefa correspondente.

**Acceptance Scenarios**:

1. **Given** um contato autorizado com tickets abertos, **When** ele inicia uma conversa sem contexto ativo, **Then** o sistema oferece opcoes para ver tickets, fazer nova solicitacao, enviar documento ou falar com atendimento.
2. **Given** um cliente com mais de uma empresa vinculada, **When** ele acessa seus tickets, **Then** o sistema permite escolher a empresa antes de listar ou direcionar tickets especificos.
3. **Given** um ticket selecionado pelo cliente, **When** o cliente envia uma nova mensagem, **Then** a mensagem e seus anexos ficam vinculados ao ticket e a tarefa correspondentes.
4. **Given** uma mensagem enviada pela tarefa, **When** o cliente responde citando essa mensagem, **Then** a resposta citada tem prioridade sobre qualquer outro contexto e e vinculada a tarefa correta.

---

### User Story 2 - Triagem transforma novas solicitacoes em tarefas e tickets (Priority: P1)

Como usuario de triagem, quero receber mensagens sem contexto ou com novos assuntos como sugestoes estruturadas, para aprovar, editar, separar, unificar, descartar ou vincular a tarefas existentes antes da criacao definitiva.

**Why this priority**: A automacao deve acelerar a triagem, mas preservar validacao humana para reduzir erro operacional, duplicidade e risco de criar tarefas indevidas.

**Independent Test**: Pode ser testado enviando uma mensagem sem ticket ativo contendo uma ou mais demandas; o sistema deve gerar sugestoes revisaveis e, apos aprovacao, criar tarefas e tickets com confirmacao ao cliente.

**Acceptance Scenarios**:

1. **Given** uma mensagem sem contexto ativo, **When** ela contem uma unica demanda operacional, **Then** o sistema gera uma sugestao de tarefa com titulo, cliente, empresa, setor, prioridade, prazo, contexto, anexos e nivel de confianca.
2. **Given** uma mensagem com multiplas entregas independentes, **When** a classificacao e concluida, **Then** o sistema gera uma sugestao separada para cada entrega identificada.
3. **Given** uma sugestao pendente, **When** a triagem aprova a sugestao, **Then** o sistema cria a tarefa, cria o ticket vinculado e envia ao cliente uma confirmacao com protocolo publico, assunto, responsavel quando houver e previsao quando houver.
4. **Given** uma sugestao com dados incorretos ou incompletos, **When** a triagem edita, separa, unifica, altera empresa, setor, responsavel, prazo ou prioridade, **Then** a tarefa criada reflete as alteracoes aprovadas e a auditoria registra a decisao.

---

### User Story 3 - Atendimento conversa pelo chat da tarefa (Priority: P2)

Como responsavel por uma tarefa, quero conversar com o cliente a partir do chat da tarefa e registrar comentarios internos separadamente, para manter comunicacao externa, contexto operacional e documentos no mesmo atendimento sem expor informacoes internas.

**Why this priority**: O chat da tarefa e o ponto de execucao do ticket; ele precisa manter rastreabilidade e evitar confusao entre comunicacao com cliente e comunicacao interna.

**Independent Test**: Pode ser testado abrindo uma tarefa com ticket, enviando mensagem ao cliente, marcando se depende de retorno e registrando um comentario interno; somente a mensagem externa deve chegar ao WhatsApp do cliente.

**Acceptance Scenarios**:

1. **Given** uma tarefa com ticket ativo, **When** o atendente envia uma mensagem ao cliente pelo chat da tarefa, **Then** a mensagem e vinculada a tarefa, ticket, conversa, cliente, atendente e status de entrega.
2. **Given** uma mensagem ao cliente que exige retorno, **When** o atendente marca essa condicao, **Then** a tarefa e o ticket passam para estado de aguardando cliente.
3. **Given** uma tarefa aguardando cliente, **When** o cliente responde ao atendimento, **Then** a tarefa volta para em andamento, o responsavel e notificado e o tempo de espera do cliente e registrado.
4. **Given** um comentario interno ou arquivo interno, **When** ele e registrado na tarefa, **Then** ele fica visivel apenas para usuarios internos autorizados e nunca aparece para o cliente.

---

### User Story 4 - Conclusao, reabertura e encerramento de tickets (Priority: P2)

Como responsavel ou lider, quero concluir, reabrir ou encerrar tickets com regras claras, para que atendimentos resolvidos nao fiquem abertos indefinidamente e divergencias relevantes sejam tratadas sem perder historico.

**Why this priority**: O ciclo de vida do ticket precisa refletir a execucao real da tarefa e permitir controle de pendencias, SLA e qualidade.

**Independent Test**: Pode ser testado concluindo uma tarefa, enviando mensagem de conclusao ao cliente, simulando agradecimento, simulando divergencia e simulando novo assunto apos conclusao.

**Acceptance Scenarios**:

1. **Given** uma tarefa pronta para conclusao, **When** o responsavel informa resumo, resultado entregue, documentos e pendencias, **Then** a tarefa e concluida, o ticket e resolvido e o cliente recebe mensagem de conclusao.
2. **Given** um ticket resolvido, **When** o cliente envia apenas agradecimento ou confirmacao, **Then** a tarefa nao e reaberta automaticamente.
3. **Given** um ticket resolvido ou encerrado, **When** o cliente relata divergencia relacionada ao atendimento, **Then** a tarefa e reaberta ou encaminhada para triagem com motivo registrado.
4. **Given** uma mensagem apos conclusao que contem novo assunto independente, **When** ela e classificada, **Then** o sistema gera nova sugestao de tarefa e nao reabre a tarefa anterior.

---

### User Story 5 - Gestao por SLA, alertas e relatorios (Priority: P3)

Como lider ou administrador, quero acompanhar prazos, alertas, filas, desempenho e auditoria dos tickets, para priorizar atendimentos, controlar capacidade e identificar gargalos operacionais.

**Why this priority**: A gestao operacional vem depois do fluxo essencial, mas e necessaria para escala, controle e melhoria continua.

**Independent Test**: Pode ser testado criando tickets com prazos variados, aguardando marcos de SLA, verificando alertas, lembretes, relatorios por setor/responsavel/cliente e registros de auditoria.

**Acceptance Scenarios**:

1. **Given** um ticket com prazo definido, **When** ele atinge 50%, 75%, 90%, 100% ou atraso, **Then** o sistema gera alerta adequado para os usuarios responsaveis.
2. **Given** uma tarefa aguardando cliente, **When** os prazos configurados de lembrete sao atingidos, **Then** o sistema envia lembretes conforme regra configurada e registra cada envio.
3. **Given** um ticket resolvido sem interacao pelo periodo configurado, **When** o prazo de encerramento e atingido, **Then** o ticket e encerrado automaticamente.
4. **Given** qualquer acao relevante no fluxo, **When** ela ocorre, **Then** o historico mostra ator, horario, entidade, acao, estado anterior, estado posterior e origem.

### Edge Cases

- Webhook ou evento repetido do provedor nao pode duplicar mensagem, anexo, sugestao, tarefa ou ticket.
- Telefone nao cadastrado deve gerar atendimento nao identificado, sem expor tickets ou dados de clientes.
- Telefone vinculado a mais de uma empresa deve exigir selecao ou inferencia segura antes de exibir tickets especificos.
- Contato bloqueado, inativo ou sem permissao ativa nao deve acessar tickets, documentos ou dados de empresa.
- Mensagens sem texto, audios sem transcricao, midias corrompidas ou arquivos bloqueados devem ser preservados com status de falha e encaminhados para triagem quando necessario.
- Mensagem com protocolo invalido ou ticket inacessivel deve receber resposta segura sem revelar existencia de dados de outros clientes.
- Resposta citada deve prevalecer sobre contexto ativo, protocolo digitado e inferencia automatica.
- Nova solicitacao explicita deve encerrar ou suspender o contexto ativo anterior antes da triagem.
- Classificacao com baixa confianca nao deve criar tarefa automaticamente.
- Falha de envio de mensagem ao cliente deve manter registro visivel ao atendente e permitir retentativa.
- Comentarios internos, auditoria, prioridade interna e observacoes restritas nunca podem ser enviados ao cliente.
- Tickets encerrados devem poder ser consultados conforme permissao, mas nao devem receber mensagens sem regra de reabertura ou nova triagem.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST receber mensagens de WhatsApp com texto, audio, imagem, documento, video, resposta citada, reacao e metadados essenciais do canal.
- **FR-002**: O sistema MUST armazenar cada mensagem recebida antes de qualquer classificacao, roteamento ou criacao de tarefa.
- **FR-003**: O sistema MUST garantir idempotencia para mensagens, anexos e eventos repetidos do provedor.
- **FR-004**: O sistema MUST identificar contatos pelo telefone e retornar empresas autorizadas, tickets visiveis, permissoes e situacao cadastral.
- **FR-005**: O sistema MUST tratar contatos desconhecidos, bloqueados, inativos ou sem permissao sem expor dados de clientes.
- **FR-006**: O cliente MUST conseguir visualizar tickets ativos, tickets com pendencia do cliente e opcoes de nova solicitacao quando iniciar conversa sem contexto ativo por mensagens interativas oficiais do WhatsApp, como listas ou botoes.
- **FR-007**: O cliente MUST conseguir selecionar empresa por mensagem interativa oficial do WhatsApp quando o contato estiver autorizado para mais de uma empresa.
- **FR-008**: O cliente MUST conseguir selecionar um ticket por mensagem interativa oficial do WhatsApp e direcionar mensagens seguintes para o chat da tarefa vinculada.
- **FR-009**: O sistema MUST manter contexto ativo por contato, empresa e ticket, com expiracao padrao de 24 horas apos a ultima interacao, configuravel por organizacao, e encerramento por troca de ticket, nova solicitacao, comando de retorno, encerramento do ticket ou acao manual.
- **FR-010**: O sistema MUST localizar tickets por protocolo informado pelo cliente e validar acesso antes de ativar contexto ou mostrar detalhes.
- **FR-011**: O sistema MUST priorizar resposta citada sobre selecao de ticket, protocolo informado, contexto ativo, inferencia automatica e triagem manual.
- **FR-012**: O sistema MUST classificar mensagens sem referencia em categorias operacionais como nova solicitacao, resposta de tarefa, upload de documento, pedido de status, complemento de informacao, agradecimento, confirmacao, reclamacao, cancelamento, ambigua ou spam.
- **FR-013**: O sistema MUST detectar quando uma mensagem contem multiplas demandas independentes e gerar sugestoes separadas.
- **FR-014**: O sistema MUST gerar sugestoes de tarefa com titulo, empresa, setor, responsavel sugerido quando houver, prazo, prioridade, contexto, resultado esperado, informacoes faltantes, anexos relacionados e confianca.
- **FR-015**: Usuarios de triagem MUST poder aprovar, aprovar em lote, editar, separar, unificar, vincular a tarefa existente, alterar empresa, setor, responsavel, prazo, prioridade, responder sem criar tarefa ou descartar sugestoes.
- **FR-016**: O sistema MUST criar uma tarefa apos aprovacao humana ou automaticamente quando a classificacao atingir alta confianca configurada, mantendo origem da mensagem, anexos, contexto e status inicial adequado.
- **FR-016a**: O limiar padrao para alta confianca de criacao automatica MUST ser 90% ou mais; classificacoes abaixo de 90% MUST permanecer como sugestao pendente de triagem humana.
- **FR-017**: O sistema MUST criar um ticket principal para cada tarefa principal criada a partir do atendimento.
- **FR-018**: O sistema MUST criar ou manter um chat da tarefa com distincao clara entre mensagem ao cliente e comentario interno.
- **FR-018a**: Comentarios e anexos internos da tarefa MUST permanecer privados por padrao e so podem ser enviados ou exibidos ao cliente quando um usuario autorizado marcar explicitamente o item como liberado ao cliente.
- **FR-019**: O sistema MUST enviar confirmacao de abertura ao cliente com protocolo publico, assunto, responsavel quando houver e previsao quando houver.
- **FR-020**: Toda mensagem enviada pela tarefa ao cliente MUST ser vinculada a tarefa, ticket, conversa, cliente, atendente e status de entrega.
- **FR-021**: O atendente MUST poder indicar se uma mensagem enviada ao cliente depende de retorno, alterando ticket e tarefa para aguardando cliente quando aplicavel.
- **FR-022**: Quando o cliente responder a uma tarefa aguardando cliente, o sistema MUST reativar a tarefa, notificar responsavel, marcar como nao lida e registrar tempo de espera.
- **FR-023**: Quando uma mensagem vinculada a ticket contem novo assunto independente, o sistema MUST preservar a mensagem no historico atual e gerar sugestao de nova tarefa para triagem.
- **FR-024**: O cliente MUST poder solicitar atualizacao de ticket; o sistema deve responder com status recente quando possivel ou notificar responsavel quando precisar de intervencao.
- **FR-025**: O sistema MUST exigir resumo de conclusao, resultado entregue, documentos enviados, pendencias e responsavel antes de concluir uma tarefa quando essas informacoes forem aplicaveis.
- **FR-026**: O sistema MUST bloquear conclusao quando houver pendencia bloqueadora, conferencia obrigatoria, documento obrigatorio, aprovacao obrigatoria ou resumo de conclusao ausente.
- **FR-027**: O sistema MUST enviar mensagem de conclusao ao cliente quando a tarefa for concluida.
- **FR-028**: O sistema MUST resolver o ticket quando a tarefa correspondente for concluida.
- **FR-029**: O sistema MUST encerrar tickets resolvidos automaticamente apos periodo configurado sem nova interacao relevante.
- **FR-030**: O sistema MUST reabrir ou encaminhar para triagem tickets resolvidos/encerrados quando o cliente relatar divergencia relacionada.
- **FR-031**: O sistema MUST evitar reabertura automatica por agradecimentos, confirmacoes simples ou respostas equivalentes.
- **FR-032**: O sistema MUST gerar nova sugestao de tarefa, sem reabrir tarefa anterior, quando mensagem apos conclusao trouxer nova demanda independente.
- **FR-033**: O sistema MUST enviar lembretes configuraveis quando estiver aguardando cliente.
- **FR-034**: O sistema MUST controlar SLA de triagem, atribuicao, primeira resposta, atualizacao, prazo final, tempo aguardando cliente, tempo aguardando terceiros, tempo total e tempo efetivo de execucao.
- **FR-035**: O sistema MUST gerar alertas em marcos configuraveis de prazo e apos vencimento.
- **FR-036**: O sistema MUST registrar auditoria integral para recebimento, classificacao, sugestao, aprovacao, criacao, vinculacao, envio, falha, alteracao de status, conclusao, reabertura, encerramento e configuracoes.
- **FR-037**: Administradores MUST poder configurar tempo de contexto ativo, tempo de encerramento, lembretes, categorias, setores, prioridades, SLA, horarios de atendimento, feriados, regras de distribuicao, limites de confianca, categorias automatizadas, mensagens padrao, permissoes e documentos sensiveis.
- **FR-038**: O sistema MUST disponibilizar indicadores por setor, responsavel, cliente, status, prazo, SLA, volume de mensagens, sugestoes, tarefas criadas, tarefas reabertas e tickets encerrados.

### Security, Access & Tenant Requirements *(mandatory when data/auth is affected)*

- **SEC-001**: A superficie afetada inclui app interno, portal/experiencia do cliente via WhatsApp, banco de dados, funcoes backend, armazenamento de arquivos, automacoes, webhooks, notificacoes e integracao externa de WhatsApp.
- **SEC-002**: Cliente e contato autorizado podem visualizar apenas seus proprios tickets externos, mensagens externas e documentos liberados; triagem pode revisar mensagens e sugestoes autorizadas; responsavel pode atuar em tarefas de seu escopo; lider pode acompanhar setor; administrador pode configurar regras e permissoes.
- **SEC-003**: Cada leitura, escrita, upload, download, automacao e notificacao MUST respeitar limites de organizacao, cliente, empresa vinculada, contato autorizado e setor responsavel.
- **SEC-004**: Credenciais, tokens, segredos, verificacao de webhooks, chamadas privilegiadas e operacoes de envio/recebimento do provedor MUST ocorrer apenas em backend ou automacao protegida.
- **SEC-005**: Comentarios internos, auditoria, urgencia interna, observacoes restritas, mensagens entre setores e dados de outros clientes MUST nunca ser exibidos ou enviados ao cliente.
- **SEC-006**: Documentos sensiveis MUST suportar controle de acesso, prazo de validade, rastreio de download e validacao adicional quando configurado.
- **SEC-007**: Todas as acoes que alteram dados operacionais MUST gerar registro de auditoria com ator, tipo de ator, horario, entidade, acao, origem e mudancas relevantes.
- **SEC-008**: Classificacao automatica e sugestoes de IA MUST respeitar permissoes e nao podem expor conteudo de outros clientes, empresas ou tickets fora do escopo do contato.

### Scalability & Performance Requirements *(mandatory for high-volume flows)*

- **PERF-001**: O fluxo deve suportar alto volume de mensagens, anexos, tickets, tarefas e relatorios com filtros primarios por organizacao, cliente, empresa, status, setor, responsavel, prazo, SLA e periodo.
- **PERF-002**: Listagens de tickets, mensagens, sugestoes, tarefas, auditoria e relatorios MUST usar carregamento paginado ou filtragem limitada por escopo e periodo.
- **PERF-003**: Processos de classificacao, envio de lembretes, alertas, encerramento e reprocessamento de falhas MUST ocorrer em segundo plano quando nao forem necessarios para resposta imediata ao usuario.
- **PERF-004**: A persistencia inicial de mensagem recebida deve acontecer rapido o suficiente para nao perder eventos do canal, mesmo quando classificacao, anexos ou automacoes demorarem mais.
- **PERF-005**: A interface interna deve manter interacao fluida ao abrir conversas longas, tickets com muitos anexos e historicos extensos.
- **PERF-006**: Success criteria MUST medir tempo de registro de mensagem, tempo de criacao de tarefa aprovada, tempo de exibicao de tickets e taxa de duplicidade evitada.

### Key Entities *(include if feature involves data)*

- **Contato autorizado**: Pessoa identificada por telefone e permissao para uma ou mais empresas/clientes.
- **Empresa/Cliente**: Unidade de negocio a qual tickets, tarefas, documentos e contatos ficam vinculados.
- **Conversa**: Historico geral de comunicacao do contato em um canal, podendo conter mensagens de varios tickets.
- **Mensagem**: Item individual de comunicacao, com direcao, tipo, conteudo, anexos, resposta citada, status e metadados.
- **Anexo**: Arquivo recebido ou enviado em uma mensagem, com tipo, tamanho, acesso, status e vinculacoes.
- **Solicitacao**: Demanda detectada em uma mensagem, antes de virar tarefa.
- **Sugestao de tarefa**: Proposta revisavel criada a partir de uma solicitacao identificada.
- **Tarefa**: Unidade operacional interna que representa uma entrega independente.
- **Ticket**: Representacao externa da tarefa para comunicacao e acompanhamento pelo cliente.
- **Chat da tarefa**: Canal vinculado a tarefa/ticket, com mensagens externas e comentarios internos separados.
- **Contexto ativo**: Vinculo temporario entre contato, empresa, ticket e tarefa para roteamento das proximas mensagens.
- **SLA/Prazo**: Conjunto de metas de tempo para triagem, resposta, execucao, espera e encerramento.
- **Auditoria**: Registro imutavel de eventos e alteracoes relevantes no fluxo.
- **Configuracao operacional**: Regras administraveis de contexto, lembrete, SLA, categorias, setores, mensagens padrao e automacoes.

### Data Classification *(include if feature involves data)*

- **Public**: Nenhum dado de ticket, tarefa, cliente, documento ou conversa deve ser publico.
- **Internal**: Mensagens internas, comentarios, sugestoes, auditoria, SLA, prioridade interna, atribuicoes, relatorios e configuracoes operacionais.
- **Client Portal**: Dados externos do ticket, status, prazo previsto, mensagens ao cliente, documentos liberados e pendencias do proprio cliente/empresa autorizada.
- **Sensitive/Regulated**: Telefones, identificadores de contato, documentos fiscais/contabeis/trabalhistas/financeiros, anexos enviados pelo cliente, conteudo de conversas, credenciais de WhatsApp, logs de integracao, dados de IA e registros de auditoria.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 95% das mensagens recebidas sao registradas e ficam visiveis para processamento em ate 2 segundos apos chegada ao sistema.
- **SC-002**: 95% das respostas enviadas por ticket selecionado ou resposta citada aparecem na tarefa correta sem intervencao manual.
- **SC-003**: Webhooks/eventos repetidos nao geram registros duplicados em 99,9% dos casos observados.
- **SC-004**: Usuarios de triagem conseguem aprovar uma sugestao simples e criar tarefa/ticket em ate 60 segundos.
- **SC-005**: Mensagens com multiplas solicitacoes geram sugestoes separadas em pelo menos 90% dos casos de teste definidos.
- **SC-005a**: 100% dos casos de teste com confianca abaixo de 90% permanecem em triagem humana e nao criam tarefa/ticket automaticamente.
- **SC-006**: 100% das mensagens enviadas pela tarefa exibem vinculacao com tarefa, ticket, cliente e atendente no historico interno.
- **SC-007**: 100% dos comentarios internos testados permanecem invisiveis para clientes.
- **SC-008**: 95% dos tickets ativos de um cliente sao listados em ate 3 segundos para uma base com volume operacional esperado.
- **SC-009**: Alertas de SLA e lembretes configurados sao gerados dentro da janela operacional definida em 95% dos casos.
- **SC-010**: A feature reduz em pelo menos 50% a necessidade de triagem manual para mensagens que respondem tickets existentes.
- **SC-011**: A taxa de tarefas duplicadas originadas de WhatsApp cai em pelo menos 40% apos ativacao do roteamento por ticket, protocolo e resposta citada.
- **SC-012**: 100% das acoes criticas testadas geram registro de auditoria com ator, horario, entidade e acao.

## Assumptions

- A primeira versao permite automacao assistida e criacao automatica apenas para classificacoes com alta confianca; criacao automatica irrestrita e resposta autonoma completa ficam fora do escopo inicial.
- O canal WhatsApp ja esta conectado ao sistema e possui capacidade de receber e enviar mensagens, midias e status de entrega.
- O cadastro de clientes, contatos, usuarios, setores e tarefas existente sera reaproveitado quando possivel.
- A classificacao automatica pode usar regras e/ou inteligencia artificial, mas decisoes com baixo nivel de confianca exigem triagem humana.
- O protocolo publico do ticket deve ser simples para comunicacao com o cliente e nao expor identificadores internos sensiveis.
- O prazo padrao sugerido para contexto ativo e 24 horas apos a ultima interacao, ajustavel por configuracao.
- O prazo padrao sugerido para encerramento automatico de tickets resolvidos e 3 dias uteis sem interacao relevante, ajustavel por configuracao.
- Lembretes sugeridos para aguardando cliente seguem janelas de 1, 3 e 5 dias uteis, mas devem ser configuraveis.
- O sistema deve preservar mensagens e anexos mesmo quando classificacao, download de midia ou envio ao cliente falharem.
- A interface deve priorizar fluxos internos eficientes, com separacao visual forte entre comunicacao com cliente e comentario interno.
