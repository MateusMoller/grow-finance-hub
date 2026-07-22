# Feature Specification: Pipeline de Vendas Comercial

**Feature Branch**: `009-sales-pipeline`

**Created**: 2026-07-22

**Status**: Draft

**Input**: User description: "Reformulacao e complementacao no modulo de vendas para criar um pipeline de vendas completo para o setor comercial, aproveitando tambem para alem de cadastrar novas oportunidades de clientes, tambem cadastrar vendas de produtos a parte, como automacoes, consultorias e sistemas, permitindo selecionar cliente existente ou cadastrar cliente novo."

## Clarifications

### Session 2026-07-22

- Q: Como as etapas do pipeline devem ser configuradas? -> A: Etapas padrao editaveis por administradores/gestores.
- Q: O que deve acontecer quando uma oportunidade de cliente novo for ganha? -> A: Criar cliente automaticamente como pendente e gerar tarefa de complementacao de cadastro.
- Q: Como o catalogo de produtos e servicos comerciais deve funcionar? -> A: Catalogo padrao editavel por administradores/gestores, com opcao Outro na oportunidade.
- Q: Para quem deve ser criada a tarefa automatica de complementacao de cadastro? -> A: Setor Comercial, sem responsavel individual obrigatorio.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Gerenciar pipeline comercial completo (Priority: P1)

Como usuario do setor comercial, quero visualizar e movimentar oportunidades em um pipeline de vendas completo para acompanhar cada negociacao desde a entrada ate o ganho, perda ou descarte.

**Why this priority**: O pipeline e o nucleo do modulo de vendas e precisa substituir a visao limitada atual por uma operacao comercial diaria clara e acionavel.

**Independent Test**: Pode ser testado criando uma oportunidade, movendo-a entre etapas do funil e verificando se status, responsavel, cliente, valor, previsao e historico ficam claros para a equipe comercial.

**Acceptance Scenarios**:

1. **Given** um usuario comercial com acesso ao modulo de vendas, **When** ele acessa a tela, **Then** visualiza um pipeline com etapas comerciais, oportunidades agrupadas por etapa e indicadores resumidos.
2. **Given** uma oportunidade em uma etapa do pipeline, **When** o usuario altera a etapa, **Then** a oportunidade passa para a nova etapa sem perder dados, historico ou responsavel.
3. **Given** uma oportunidade marcada como ganha ou perdida, **When** o pipeline e atualizado, **Then** ela deixa de aparecer como oportunidade ativa e passa a compor os indicadores adequados.

---

### User Story 2 - Cadastrar oportunidades para cliente existente ou novo (Priority: P1)

Como usuario comercial, quero cadastrar uma oportunidade vinculada a um cliente ja existente ou a um novo cliente para registrar negociacoes sem duplicar cadastros e sem perder leads novos.

**Why this priority**: O comercial precisa trabalhar tanto com a base atual quanto com novos contatos. O fluxo deve evitar retrabalho e preservar a origem comercial da oportunidade.

**Independent Test**: Pode ser testado criando uma oportunidade para um cliente existente e outra para um cliente novo, verificando se ambas entram no pipeline e mantem vinculo claro com o cliente ou lead correspondente.

**Acceptance Scenarios**:

1. **Given** um cliente existente na base, **When** o usuario cria uma oportunidade e seleciona esse cliente, **Then** a oportunidade fica vinculada ao cliente sem criar duplicidade.
2. **Given** um contato que ainda nao e cliente, **When** o usuario cria uma oportunidade e escolhe cadastrar cliente novo, **Then** o sistema registra os dados minimos do contato e vincula a oportunidade a esse novo cadastro ou pre-cadastro comercial.
3. **Given** dados incompletos de um novo cliente, **When** o usuario tenta salvar a oportunidade, **Then** o sistema indica quais campos minimos faltam para a negociacao ser acompanhavel.
4. **Given** uma oportunidade de cliente novo marcada como ganha, **When** o resultado e salvo, **Then** o sistema cria automaticamente o cliente como cadastro pendente e gera uma tarefa de complementacao de cadastro para o setor Comercial, sem responsavel individual obrigatorio.

---

### User Story 3 - Vender produtos e servicos avulsos (Priority: P1)

Como usuario comercial, quero cadastrar vendas de produtos ou servicos avulsos, como automacoes, consultorias e sistemas, para controlar receitas comerciais que nao sao apenas entrada de novos clientes contabeis.

**Why this priority**: O modulo deve refletir o modelo comercial real, incluindo ofertas pontuais e recorrentes alem dos servicos tradicionais de contabilidade.

**Independent Test**: Pode ser testado cadastrando uma oportunidade de automacao, consultoria ou sistema, informando produto, valor, recorrencia quando aplicavel e acompanhando a negociacao no pipeline.

**Acceptance Scenarios**:

1. **Given** uma lista de tipos de oferta comercial, **When** o usuario cria uma oportunidade, **Then** pode escolher entre oportunidade de cliente/servico contabil e venda de produto ou servico avulso.
2. **Given** uma oportunidade de produto avulso, **When** o usuario preenche os dados comerciais, **Then** o pipeline exibe produto, valor, cliente/lead, responsavel e etapa.
3. **Given** uma venda de consultoria, sistema ou automacao concluida, **When** ela e marcada como ganha, **Then** o sistema registra o ganho e mantem a negociacao rastreavel no historico comercial.
4. **Given** um usuario administrador ou gestor, **When** ele gerencia o catalogo comercial, **Then** pode criar, editar e inativar produtos ou servicos comerciais padrao.
5. **Given** uma oferta que nao existe no catalogo, **When** o usuario comercial cria a oportunidade, **Then** pode selecionar "Outro" e descrever a oferta sem alterar o catalogo padrao.

---

### User Story 4 - Acompanhar atividades, follow-ups e historico da negociacao (Priority: P2)

Como usuario comercial, quero registrar atividades, proximos contatos, observacoes e historico de alteracoes em cada oportunidade para que qualquer pessoa autorizada entenda o andamento da negociacao.

**Why this priority**: Um pipeline sem acompanhamento operacional vira apenas uma lista. O historico reduz perda de contexto e melhora continuidade do atendimento.

**Independent Test**: Pode ser testado adicionando uma observacao, definindo um proximo contato, alterando valores ou etapa e verificando se essas acoes aparecem na linha do tempo da oportunidade.

**Acceptance Scenarios**:

1. **Given** uma oportunidade ativa, **When** o usuario registra uma atividade ou observacao, **Then** o registro aparece no historico da negociacao com data e autor.
2. **Given** uma oportunidade com proximo contato definido, **When** a data se aproxima ou vence, **Then** ela aparece como pendencia/follow-up para o comercial.
3. **Given** uma alteracao relevante na oportunidade, **When** valor, etapa, responsavel, previsao ou status e alterado, **Then** o historico registra a mudanca.

---

### User Story 5 - Medir desempenho comercial (Priority: P2)

Como gestor ou usuario autorizado, quero visualizar indicadores do pipeline para acompanhar valor em aberto, conversao, negocios ganhos/perdidos, origem, produto e responsavel.

**Why this priority**: O setor comercial precisa medir desempenho e priorizar negociacoes com base em dados claros.

**Independent Test**: Pode ser testado criando oportunidades em diferentes etapas, responsaveis e produtos, e validando se os indicadores refletem o pipeline filtrado.

**Acceptance Scenarios**:

1. **Given** oportunidades cadastradas em varias etapas, **When** o usuario acessa o modulo, **Then** visualiza totais por etapa, valor previsto, ganhos, perdas e taxa de conversao.
2. **Given** filtros por periodo, responsavel, produto, status ou origem, **When** o usuario aplica um filtro, **Then** a lista e os indicadores sao recalculados conforme o recorte escolhido.
3. **Given** uma oportunidade ganha ou perdida, **When** o resultado e salvo, **Then** os indicadores de resultado comercial sao atualizados.

### Edge Cases

- Quando um cliente novo informado ja possui CNPJ, telefone ou e-mail semelhante a um cadastro existente, o sistema deve alertar sobre possivel duplicidade antes de salvar.
- Quando uma oportunidade ganha estiver vinculada a um cliente novo, o sistema deve indicar claramente se esse cliente ainda precisa completar cadastro operacional fora do modulo comercial.
- Quando o cliente novo for criado automaticamente a partir de uma oportunidade ganha, o sistema deve evitar duplicidade e gerar apenas uma tarefa ativa de complementacao de cadastro para esse cliente.
- Quando uma oportunidade perder responsavel ativo por inativacao de usuario, ela deve permanecer no pipeline com sinalizacao para redistribuicao.
- Quando uma etapa do pipeline nao tiver oportunidades, ela deve continuar visivel para preservar a leitura do funil.
- Quando o usuario nao tiver permissao comercial, ele nao deve conseguir visualizar, criar ou alterar oportunidades.
- Quando o valor da negociacao ainda nao estiver definido, a oportunidade deve poder existir, mas deve ser sinalizada como sem valor estimado.
- Quando houver produtos com recorrencia e produtos de venda unica, o pipeline deve distinguir os impactos comerciais de cada tipo sem misturar metricas.
- Quando uma oferta do catalogo for inativada, oportunidades historicas devem manter a oferta registrada, mas novas oportunidades devem ocultar a oferta inativa da selecao padrao.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST oferecer um pipeline de vendas com etapas padrao para acompanhar negociacoes comerciais ativas.
- **FR-021**: O sistema MUST permitir que administradores e gestores criem, editem, ordenem e inativem etapas do pipeline; usuarios comerciais sem permissao de gestao podem usar as etapas ativas, mas nao gerencia-las.
- **FR-002**: O sistema MUST permitir que usuarios autorizados criem, editem, movimentem, ganhem, percam e arquivem oportunidades comerciais.
- **FR-003**: O sistema MUST permitir criar oportunidades vinculadas a clientes existentes.
- **FR-004**: O sistema MUST permitir criar oportunidades para clientes novos, capturando dados minimos para contato e qualificacao comercial.
- **FR-005**: O sistema MUST prevenir ou alertar sobre possiveis duplicidades ao cadastrar cliente novo durante uma oportunidade.
- **FR-006**: O sistema MUST permitir classificar a oportunidade por tipo de venda, incluindo pelo menos servico contabil/cliente, automacao, consultoria e sistema.
- **FR-024**: O sistema MUST oferecer catalogo comercial padrao de produtos e servicos editavel por administradores e gestores.
- **FR-025**: O sistema MUST permitir selecionar a opcao "Outro" em uma oportunidade e registrar uma descricao livre da oferta sem criar item novo no catalogo.
- **FR-026**: O sistema MUST permitir inativar itens do catalogo comercial, mantendo-os visiveis em oportunidades historicas e ocultos para novas selecoes padrao.
- **FR-007**: O sistema MUST permitir registrar valor estimado, probabilidade, previsao de fechamento, origem, responsavel, etapa e status da oportunidade.
- **FR-008**: O sistema MUST permitir diferenciar produto ou servico de venda unica e produto ou servico recorrente.
- **FR-009**: O sistema MUST permitir registrar atividades, observacoes, proximos contatos e follow-ups dentro da oportunidade.
- **FR-010**: O sistema MUST registrar historico de alteracoes relevantes em oportunidades, incluindo autor, data e conteudo alterado.
- **FR-011**: O sistema MUST exibir indicadores de pipeline, incluindo valor em aberto, oportunidades ativas, negocios ganhos, negocios perdidos e conversao.
- **FR-012**: O sistema MUST permitir filtros por periodo, etapa, status, responsavel, cliente, tipo de venda, produto/servico e origem.
- **FR-013**: O sistema MUST permitir busca por cliente, contato, titulo da oportunidade, CNPJ, telefone, e-mail ou produto/servico.
- **FR-014**: O sistema MUST permitir que oportunidades ganhas mantenham vinculo com o cliente e com o produto/servico vendido para consulta futura.
- **FR-015**: O sistema MUST manter oportunidades perdidas com motivo de perda e data de encerramento.
- **FR-016**: O sistema MUST permitir reabrir uma oportunidade encerrada quando autorizado, mantendo historico da reabertura.
- **FR-017**: O sistema MUST sinalizar oportunidades sem proximo passo, sem responsavel, vencidas ou paradas ha tempo excessivo.
- **FR-018**: O sistema MUST oferecer uma experiencia visual limpa, dinamica e adequada ao uso diario do setor comercial.
- **FR-019**: O sistema MUST manter a nomenclatura do modulo como "Vendas" e concentrar nele as funcoes de pipeline comercial.
- **FR-020**: O sistema MUST preservar clientes existentes, permissoes e demais modulos durante a reformulacao do modulo de vendas.
- **FR-022**: O sistema MUST criar automaticamente um cliente com status de cadastro pendente quando uma oportunidade de cliente novo for marcada como ganha.
- **FR-023**: O sistema MUST gerar automaticamente uma tarefa de complementacao de cadastro para o setor Comercial quando o cliente for criado a partir de uma oportunidade ganha, sem exigir responsavel individual e sem duplicar tarefa ativa para o mesmo cliente e finalidade.

### Security, Access & Tenant Requirements *(mandatory when data/auth is affected)*

- **SEC-001**: A superficie afetada e o app interno, com dados comerciais vinculados a organizacao, usuarios internos e clientes.
- **SEC-002**: Usuarios com acesso ao modulo de vendas podem visualizar oportunidades; criacao e edicao devem respeitar permissoes comerciais definidas no cadastro de usuarios.
- **SEC-008**: Apenas administradores e gestores podem criar, editar ou inativar itens do catalogo comercial; usuarios comerciais podem apenas selecionar itens ativos ou usar a opcao "Outro".
- **SEC-003**: Clientes e oportunidades devem permanecer restritos a organizacao atual do usuario; nenhuma leitura ou alteracao pode cruzar organizacoes.
- **SEC-004**: Usuarios sem acesso ao modulo de vendas nao podem visualizar pipeline, indicadores, detalhes, atividades ou historico comercial.
- **SEC-005**: Alteracoes em status, etapa, valor, responsavel, cliente vinculado, produto/servico, previsao, ganho, perda e reabertura devem gerar registro de auditoria.
- **SEC-006**: Dados sensiveis de contato e identificacao de cliente devem seguir as mesmas restricoes ja aplicadas ao modulo de clientes.
- **SEC-007**: A criacao automatica de cliente e tarefa a partir de oportunidade ganha deve validar organizacao, permissao do usuario, origem da oportunidade e ausencia de duplicidade antes de gravar dados.
- **SEC-009**: A tarefa automatica de complementacao de cadastro deve respeitar a organizacao da oportunidade e ser vinculada ao setor Comercial, sem depender de um usuario responsavel obrigatorio.

### Scalability & Performance Requirements *(mandatory for high-volume flows)*

- **PERF-001**: O modulo deve suportar ao menos 10.000 oportunidades comerciais por organizacao sem exigir carregamento integral para cada visualizacao.
- **PERF-002**: Listas e indicadores devem priorizar filtros por status, etapa, responsavel, periodo, cliente e tipo de venda.
- **PERF-003**: A tela principal deve carregar o pipeline e indicadores iniciais em ate 3 segundos para uma base operacional comum.
- **PERF-004**: Busca e filtros devem retornar resultados percebidos em ate 1 segundo para uso diario do comercial.
- **PERF-005**: Historico e atividades de oportunidades devem ser carregados de forma limitada por oportunidade, sem impactar a tela principal do pipeline.

### Key Entities *(include if feature involves data)*

- **Oportunidade Comercial**: Negociacao acompanhada no pipeline; possui titulo, cliente ou lead, responsavel, etapa, status, tipo de venda, valor, previsao, origem, probabilidade e resultado.
- **Cliente Existente**: Cliente ja cadastrado no sistema que pode receber novas oportunidades ou produtos vendidos.
- **Cliente Novo/Lead Comercial**: Contato ainda nao consolidado como cliente operacional, usado para cadastrar e acompanhar uma oportunidade.
- **Produto ou Servico Comercial**: Oferta negociada, como automacao, consultoria, sistema ou servico contabil, com indicacao de venda unica ou recorrente; pertence a um catalogo padrao editavel por administradores e gestores, com suporte a opcao "Outro" na oportunidade.
- **Etapa do Pipeline**: Fase comercial usada para organizar oportunidades ativas; possui etapas padrao do sistema e pode ser criada, editada, ordenada ou inativada por administradores e gestores.
- **Atividade Comercial**: Registro de contato, anotacao, follow-up, reuniao, proposta ou proximo passo vinculado a oportunidade.
- **Resultado Comercial**: Estado final da oportunidade, como ganha ou perdida, incluindo motivo, data e valor final quando aplicavel.
- **Tarefa de Complementacao de Cadastro**: Tarefa operacional criada automaticamente para o setor Comercial quando um cliente nasce de uma oportunidade ganha e ainda precisa completar dados cadastrais; nao exige responsavel individual obrigatorio.

### Data Classification *(include if feature involves data)*

- **Public**: Nao ha dados publicos nesta feature.
- **Internal**: Pipeline, oportunidades, atividades, historico, indicadores comerciais, responsaveis e produtos vendidos.
- **Client Portal**: Nao ha exposicao prevista no portal do cliente nesta fase.
- **Sensitive/Regulated**: Dados de identificacao e contato de clientes, CNPJ, informacoes comerciais, valores negociados, propostas e historico de relacionamento.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Usuarios comerciais conseguem cadastrar uma nova oportunidade completa em ate 2 minutos.
- **SC-002**: Usuarios comerciais conseguem localizar uma oportunidade existente por busca ou filtro em ate 30 segundos.
- **SC-003**: 95% das oportunidades ativas exibem etapa, responsavel, cliente/lead, tipo de venda e proximo passo ou sinalizacao de pendencia.
- **SC-004**: Indicadores de pipeline refletem corretamente oportunidades ativas, ganhas e perdidas em 100% dos cenarios de aceite definidos.
- **SC-005**: O cadastro de oportunidade para cliente existente nao cria duplicidade de cliente em 100% dos testes de aceite.
- **SC-006**: O fluxo de venda de produto avulso registra tipo, valor, cliente/lead e status em 100% dos testes de aceite.
- **SC-007**: Usuarios autorizados conseguem mover oportunidades entre etapas sem perda de dados em 100% dos testes de aceite.
- **SC-008**: Usuarios sem permissao comercial sao bloqueados de acessar dados comerciais em 100% dos testes de permissao.
- **SC-009**: 100% das oportunidades ganhas para cliente novo criam um cliente pendente e uma tarefa de complementacao de cadastro para o setor Comercial, sem responsavel individual obrigatorio e sem duplicidade ativa.
- **SC-010**: 100% dos usuarios sem permissao de gestao ficam impedidos de alterar o catalogo comercial, mas conseguem criar oportunidades usando itens ativos ou a opcao "Outro".

## Assumptions

- O modulo reformulado sera usado principalmente pelo setor comercial e por gestores autorizados.
- A primeira versao nao expoe oportunidades comerciais no portal do cliente.
- O cadastro de cliente novo dentro de vendas pode comecar como cadastro comercial minimo e exigir complementacao posterior no modulo de clientes quando necessario.
- Ao ganhar uma oportunidade de cliente novo, o sistema passa a tratar esse contato como cliente pendente no modulo Clientes e cria uma tarefa operacional para concluir o cadastro.
- A tarefa de complementacao de cadastro criada a partir de vendas deve seguir o padrao operacional de tarefas por setor, usando Comercial como setor responsavel.
- Produtos avulsos iniciais incluem automacoes, consultorias e sistemas, mas a lista deve permitir expansao futura.
- O catalogo comercial comeca com ofertas padrao e pode ser mantido por administradores e gestores sem exigir alteracao tecnica.
- O pipeline tera etapas padrao suficientes para operacao comercial diaria, com possibilidade de ajustes por administradores e gestores.
- Metricas comerciais devem considerar oportunidades ativas, ganhas e perdidas, distinguindo venda unica e recorrente quando aplicavel.
- A reformulacao deve reaproveitar dados existentes do modulo atual sempre que possivel, sem remover historico comercial valido.
