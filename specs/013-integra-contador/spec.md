# Feature Specification: Integra Contador — Fundação e Sincronização Fiscal Inicial

**Feature Branch**: `013-integra-contador`

**Created**: 2026-08-14

**Status**: Draft

**Input**: Criar a especificação inicial da integração com o Integra Contador/SERPRO como motor de sincronização fiscal, aproveitando os módulos existentes de Clientes, Obrigações, Tarefas, Calendário e Financeiro da Grow Finance.

**SPEC_CONTEXT**: `INTEGRACAO_INTEGRA_CONTADOR`

## Clarifications

### Session 2026-08-14

- Q: Qual deve ser a janela operacional usada pelo SC-002 para que 95% das sincronizações elegíveis concluam ou apresentem uma ação humana específica? → A: Até 15 minutos.
- Q: Como o SC-004 deve medir cache e tempo de abertura da situação fiscal? → A: p95 de até 2 segundos em teste de carga e cache hit de pelo menos 90% das consultas elegíveis na telemetria piloto.
- Q: Quando começa e termina a medição de cinco minutos do SC-001? → A: Inclui o cadastro das credenciais e do certificado, partindo de um administrador autorizado já de posse dos materiais válidos e terminando na exibição do estado operacional ou da ação necessária.
- Q: Como o gate documental para novos domínios fiscais deve ser aplicado? → A: Template obrigatório com validação automatizada no CI.
- Q: Qual deve ser a regra central para CPF e CNPJ recebidos? → A: Remover formatação, preservar como texto, validar comprimento e dígitos verificadores e rejeitar antes da fila quando inválido.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ativar e validar a integração fiscal (Priority: P1)

Como administrador da Grow Finance, quero configurar e validar a conexão institucional com o Integra Contador para saber se a organização está apta a consultar dados fiscais dos clientes sem expor credenciais, certificados ou detalhes técnicos aos demais usuários.

**Why this priority**: Nenhuma consulta ou automação fiscal é segura sem conexão válida, separação por organização, certificado compatível e contexto de autorização verificável.

**Independent Test**: Pode ser testada configurando uma organização em ambiente não produtivo, executando a validação de conexão e confirmando que o administrador recebe um estado compreensível de disponibilidade, credenciais, certificado e autorização sem visualizar segredos.

**Acceptance Scenarios**:

1. **Given** uma organização com contratação, credenciais e certificado válidos, **When** um administrador autorizado testa a integração, **Then** o sistema informa que a conexão está operacional e registra a verificação.
2. **Given** credencial ausente, certificado inválido ou ambiente incompatível, **When** o administrador testa a integração, **Then** o sistema bloqueia o uso, identifica a ação necessária e não revela material secreto.
3. **Given** um usuário sem permissão de administração da integração, **When** tenta acessar configurações ou testar credenciais, **Then** o acesso é negado e auditado.

---

### User Story 2 - Sincronizar situação fiscal por cliente (Priority: P1)

Como colaborador fiscal autorizado, quero consultar e sincronizar informações fiscais de um cliente a partir da ficha já existente para trabalhar com dados atuais sem entrar cliente por cliente no e-CAC.

**Why this priority**: Entrega o primeiro valor operacional da integração e valida, com baixo risco, o vínculo entre organização, cliente, contribuinte, autorização e dados normalizados.

**Independent Test**: Pode ser testada com um cliente autorizado, iniciando uma sincronização de leitura e verificando que o resultado persistido aparece na situação fiscal do cliente e pode ser reutilizado sem nova consulta externa enquanto estiver válido.

**Acceptance Scenarios**:

1. **Given** um cliente pertencente à organização e com autorização válida, **When** um colaborador autorizado solicita sincronização, **Then** o sistema processa a solicitação, persiste o resultado e mostra a última atualização em linguagem de negócio.
2. **Given** uma informação equivalente ainda válida localmente, **When** o usuário abre a situação fiscal, **Then** o sistema apresenta o resultado existente sem consumo externo desnecessário.
3. **Given** procuração ausente, expirada ou insuficiente para o serviço, **When** a sincronização é solicitada, **Then** o cliente recebe estado `REQUIRES_ACTION`, o motivo e a orientação de regularização, sem tentativas repetidas indevidas.
4. **Given** indisponibilidade temporária do provedor, **When** a sincronização falha, **Then** o sistema preserva o último dado confiável, informa que ele pode estar desatualizado e reagenda somente quando a falha for elegível.

---

### User Story 3 - Automatizar por eventos e exceções (Priority: P2)

Como gestor fiscal, quero que a Grow monitore alterações da Receita e sincronize somente clientes e domínios afetados para reduzir consultas, custos e trabalho manual.

**Why this priority**: Transforma a integração de consulta sob demanda em motor operacional escalável, mantendo reconciliação periódica para recuperar eventos eventualmente perdidos.

**Independent Test**: Pode ser testada simulando um evento de atualização para um conjunto de contribuintes, confirmando que somente os itens alterados geram sincronização, que eventos repetidos não duplicam processamento e que eventos antigos são reconciliados dentro da janela definida.

**Acceptance Scenarios**:

1. **Given** um lote de clientes monitoráveis, **When** o provedor sinaliza alteração para um contribuinte, **Then** somente o domínio e o cliente afetados entram na fila de sincronização.
2. **Given** o mesmo evento recebido ou consultado mais de uma vez, **When** ele é processado novamente, **Then** nenhum resultado, documento, tarefa ou obrigação é duplicado.
3. **Given** nenhum evento novo, **When** o monitoramento é executado, **Then** nenhuma consulta fiscal desnecessária é disparada.
4. **Given** um evento não capturado pelo monitoramento incremental, **When** ocorre a reconciliação periódica, **Then** a divergência é encontrada e processada com motivo de sincronização identificável.

---

### User Story 4 - Trabalhar exceções nos módulos existentes (Priority: P2)

Como colaborador fiscal, quero receber nas filas atuais apenas situações que exigem trabalho humano, com cliente, prazo, contexto e ação recomendada, para não precisar operar uma segunda fila técnica.

**Why this priority**: Preserva a experiência já conhecida e evita que eventos técnicos se tornem ruído operacional.

**Independent Test**: Pode ser testada simulando uma nova mensagem fiscal relevante e uma atualização sem ação; apenas a primeira deve criar uma pendência idempotente no fluxo existente, enquanto ambas atualizam o histórico do cliente.

**Acceptance Scenarios**:

1. **Given** uma alteração fiscal resolvida automaticamente com segurança, **When** ela é processada, **Then** o sistema atualiza o registro correspondente sem criar tarefa desnecessária.
2. **Given** uma alteração que exige análise humana, **When** ela é classificada, **Then** o sistema cria uma única tarefa no setor adequado, vinculada ao cliente e ao contexto fiscal.
3. **Given** uma confirmação oficial compatível com uma obrigação existente, **When** a regra automática é conclusiva, **Then** a obrigação e sua tarefa relacionada são atualizadas pela operação autorizada e auditável já existente.
4. **Given** uma correspondência ambígua entre dado fiscal e obrigação, pagamento ou cliente, **When** a automação não alcança confiança suficiente, **Then** o sistema mantém os registros inalterados e encaminha uma revisão fiscal.

---

### User Story 5 - Acompanhar operação, consumo e falhas (Priority: P3)

Como administrador ou gestor autorizado, quero acompanhar saúde, sincronizações, consumo, falhas e ações pendentes da integração para intervir antes que a operação fiscal seja prejudicada.

**Why this priority**: A operação externa envolve custo, limites, certificados, procurações e indisponibilidades que precisam ser observáveis sem expor detalhes sensíveis.

**Independent Test**: Pode ser testada executando sincronizações bem-sucedidas, com cache, com falha temporária e com autorização ausente, verificando que o painel distingue cada resultado e permite reprocessar somente falhas elegíveis.

**Acceptance Scenarios**:

1. **Given** operações realizadas no período, **When** um gestor abre o monitoramento, **Then** vê totais de sucesso, falha, cache, consumo, pendências e última execução por domínio.
2. **Given** uma falha temporária que esgotou as tentativas automáticas, **When** um usuário com permissão solicita reprocessamento, **Then** uma nova tentativa controlada é criada sem duplicar a operação original.
3. **Given** uma falha definitiva de entrada, autorização ou certificado, **When** o gestor consulta o item, **Then** o sistema apresenta `REQUIRES_ACTION` e não oferece repetição automática como solução.

### Edge Cases

### User Story 6 - Operar DCTFWeb dentro da tarefa (Priority: P1)

Como colaborador fiscal autorizado, quero consultar a DCTFWeb, conferir seus documentos e emitir o DARF dentro da tarefa canônica do cliente para concluir a obrigação sem alternar entre módulos ou duplicar controles.

**Independent Test**: Abrir uma tarefa DCTFWeb, preparar um único dossiê para cliente/competência, consultar XML/recibo/relatório e gerar um DARF Trial idempotente, confirmando que os artefatos são privados e vinculados à mesma entrega.

**Acceptance Scenarios**:

1. **Given** uma tarefa DCTFWeb válida, **When** ela é aberta, **Then** o sistema prepara ou reutiliza um único dossiê vinculado à obrigação e mostra somente ações compatíveis com o estado.
2. **Given** uma declaração transmitida, **When** o usuário consulta recibo/relatório e confirma a emissão, **Then** o DARF é gerado uma única vez, armazenado privadamente e vinculado à entrega.
3. **Given** uma declaração em andamento, **When** o usuário solicita a guia, **Then** o sistema usa o serviço específico de andamento sem marcar a declaração como transmitida.
4. **Given** XML assinado e versão aprovada, **When** um usuário autorizado confirma uma transmissão habilitada, **Then** o backend revalida todos os gates e registra o efeito; timeout ambíguo não provoca repetição cega.
5. **Given** uma tarefa PGDAS-D, DEFIS ou genérica, **When** a integração DCTFWeb é habilitada, **Then** seu comportamento permanece inalterado.

- O cliente foi inativado ou transferido de organização enquanto havia sincronização pendente.
- CPF ou CNPJ recebido não corresponde ao cliente vinculado, está inválido ou utiliza formato futuro ainda não reconhecido.
- A mesma competência aparece em formatos diferentes ou a resposta não informa competência.
- A procuração permite alguns serviços, mas não o serviço solicitado.
- O certificado ou credencial é rotacionado enquanto há trabalhos em andamento.
- O token expira durante uma sequência de operações.
- O provedor retorna processamento aceito ou sem conteúdo e exige espera antes da próxima consulta.
- O limite diário ou por lote é atingido durante monitoramento.
- Uma resposta válida chega após timeout local e a operação é solicitada novamente.
- Duplo clique, repetição de evento, reenvio de job ou execução concorrente tenta produzir o mesmo efeito.
- Um documento retornado tem referência diferente, mas conteúdo idêntico a um já armazenado.
- O dado da Receita diverge do estado atual de obrigação, pagamento ou tarefa.
- A sincronização parcial atualiza um domínio e falha em outro.
- O último dado confiável existe, mas sua validade expirou durante indisponibilidade externa.
- Um usuário do portal tenta acessar mensagens, payloads, logs ou estados internos ainda não publicados.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST tratar o Integra Contador como provedor fiscal externo e oferecer um único ponto institucional de comunicação, sem chamadas externas originadas diretamente de telas, fluxos de negócio ou repositórios operacionais.
- **FR-002**: O sistema MUST separar claramente infraestrutura do provedor, domínios fiscais e workflows de negócio, impedindo que regras de Tarefas, Obrigações, Calendário, Clientes ou Financeiro dependam de códigos e formatos externos.
- **FR-003**: O sistema MUST manter um cadastro de conexão por organização e ambiente, com estado operacional, domínios habilitados, última validação, última execução bem-sucedida e ação necessária.
- **FR-004**: O sistema MUST autenticar o contratante com credenciais e certificado institucional válidos, reutilizar tokens temporários enquanto válidos e permitir renovação de credenciais e certificado sem alterar os módulos fiscais.
- **FR-005**: O sistema MUST resolver, a partir da organização e do cliente, as identidades de contratante, autor do pedido e contribuinte antes de qualquer operação fiscal.
- **FR-006**: O sistema MUST verificar se a autorização ou procuração aplicável cobre o serviço solicitado e distinguir autorização válida, ausente, expirada, insuficiente e pendente de validação.
- **FR-007**: O sistema MUST manter um catálogo central versionado das capacidades externas utilizadas, incluindo natureza da operação, domínio fiscal, necessidade de procuração, possibilidade de monitoramento, sensibilidade, validade de cache e elegibilidade de repetição.
- **FR-008**: A primeira entrega MUST habilitar uma fundação compartilhada e ao menos um domínio de consulta somente leitura, escolhido no planejamento pela menor dependência operacional e capacidade de validar autenticação, autorização, persistência, auditoria e consumo ponta a ponta.
- **FR-009**: Caixa Postal, pagamentos e DCTFWeb MUST permanecer como domínios prioritários da expansão inicial, mas transmissão de declarações, apuração, emissão em lote e demais operações com efeito externo ficam fora do MVP até que a fundação e o primeiro domínio sejam aprovados.
- **FR-010**: O sistema MUST oferecer ao usuário ações em linguagem de negócio, como sincronizar Receita, consultar declaração, ver mensagens e consultar pagamentos, sem expor códigos técnicos ou envelopes do provedor.
- **FR-011**: Toda resposta fiscal relevante MUST ser validada, normalizada e persistida antes de ser exibida ou usada por regras internas; o formato bruto do provedor não pode se tornar o contrato dos módulos existentes.
- **FR-012**: CPF e CNPJ MUST ser normalizados pela remoção de formatação, preservados como identificadores textuais e validados centralmente por comprimento e dígitos verificadores antes de qualquer enfileiramento; identificadores inválidos MUST ser rejeitados sem consumo externo. Competências, períodos, datas e valores monetários MUST possuir significado único e consistente em todos os domínios.
- **FR-013**: O sistema MUST classificar dados por natureza e definir validade própria para cache; resultados permanentes, como documentos ou confirmações, não podem depender apenas de cache temporário.
- **FR-014**: Antes de uma consulta externa, o sistema MUST verificar se há resultado local ainda válido para a mesma organização, cliente, serviço, período e parâmetros relevantes.
- **FR-015**: Toda sincronização MUST registrar seu motivo entre solicitação do usuário, evento monitorado, reconciliação programada, importação inicial, repetição automática ou reprocessamento administrativo.
- **FR-016**: Sempre que o domínio suportar eventos de atualização, rotinas automáticas MUST monitorar antes de consultar e sincronizar apenas contribuintes e tópicos alterados.
- **FR-017**: O sistema MUST executar reconciliação periódica configurável para detectar alterações eventualmente não capturadas pelo monitoramento.
- **FR-018**: Operações em lote, monitoramento e sincronizações demoradas MUST ocorrer em segundo plano, com progresso consultável e sem manter o usuário preso a uma única solicitação.
- **FR-019**: Cada trabalho em segundo plano MUST conter apenas identificadores internos e parâmetros indispensáveis, nunca certificados, senhas, credenciais ou tokens.
- **FR-020**: Toda operação com possível efeito externo MUST possuir chave de idempotência, controle de concorrência e consulta prévia do estado quando aplicável.
- **FR-021**: O sistema MUST impedir duplicação de eventos, sincronizações, documentos, tarefas, obrigações e operações por identidade externa, chave lógica ou hash de conteúdo conforme o domínio.
- **FR-022**: O sistema MUST distinguir sucesso, processamento externo em andamento, ausência de conteúdo, falha temporária, limite excedido, falha definitiva e ação humana necessária.
- **FR-023**: Repetições automáticas MUST ocorrer somente para falhas elegíveis, com limite e espera progressiva; falhas de entrada, autorização, procuração ou certificado não podem entrar em repetição cega.
- **FR-024**: Uma falha externa MUST preservar o último dado confiável e informar sua data e possível desatualização, sem apresentar dado antigo como confirmação atual.
- **FR-025**: Toda chamada externa MUST registrar consumo, duração, resultado, origem, uso ou não de cache, identificador rastreável e correlação com cliente, usuário, workflow e trabalho, quando aplicável.
- **FR-026**: O identificador enviado ao provedor MUST respeitar o limite oficial, permitir conciliação com relatórios de consumo e não expor desnecessariamente identificadores fiscais em interfaces ou logs.
- **FR-027**: O sistema MUST registrar auditoria de configuração, autorização, sincronização, reprocessamento, geração de pendência e mudança operacional resultante.
- **FR-028**: Payloads brutos MUST ser armazenados somente quando necessários, permitidos, sanitizados, protegidos e sujeitos a política de retenção; segredos e tokens completos nunca podem ser persistidos em logs.
- **FR-029**: Resultados conclusivos MUST atualizar os módulos existentes por contratos autorizados e idempotentes; resultados ambíguos MUST gerar revisão sem alterar automaticamente o estado operacional.
- **FR-030**: Tarefas automáticas MUST ser criadas apenas quando houver ação humana concreta e MUST conter cliente, motivo, prioridade, prazo quando conhecido, origem, contexto e ação recomendada.
- **FR-031**: O módulo administrativo Integra Contador MUST apresentar visão geral, clientes vinculados, monitoramento e configurações, enquanto o trabalho diário permanece nas telas existentes de Cliente, Obrigações, Tarefas, Calendário e Financeiro.
- **FR-032**: A ficha do cliente MUST apresentar uma visão fiscal consolidada com autorização, última sincronização, domínios disponíveis, dados recentes e ações permitidas ao usuário.
- **FR-033**: O portal do cliente MUST receber apenas projeções explicitamente publicadas e limitadas à empresa vinculada; detalhes técnicos, mensagens não revisadas, auditoria, consumo e payloads ficam restritos ao aplicativo interno.
- **FR-034**: O sistema MUST suportar liberação progressiva por organização e domínio, permitindo interromper uma capacidade sem desativar toda a integração.
- **FR-035**: O sistema MUST disponibilizar um provedor simulado para validar cenários de sucesso, autorização, duplicidade, indisponibilidade, processamento assíncrono e limite sem consumir operações reais.
- **FR-036**: Cada novo domínio fiscal MUST preencher um template versionado com requisito, capacidade externa, pré-condições, entrada, saída, estados, idempotência, cache, monitoramento, repetição, auditoria, segurança, critérios de aceitação e testes antes da implementação; o CI MUST validar automaticamente a presença e o preenchimento desses campos e bloquear a entrega quando o contrato estiver incompleto.
- **FR-037**: O sistema MUST preparar ou reutilizar um único dossiê DCTFWeb a partir da tarefa e da instância canônica, sem criar tarefa, obrigação ou fila operacional paralela.
- **FR-038**: Consultas de XML, recibo e relatório e emissões de DARF MUST usar os serviços DCTFWeb versionados, persistir metadados normalizados e manter conteúdo fiscal em armazenamento privado.
- **FR-039**: A emissão de DARF MUST exigir confirmação explícita, chave de idempotência e revalidação do estado da declaração; emissão em lote permanece proibida.
- **FR-040**: A transmissão DCTFWeb MUST permanecer desabilitada por padrão e exigir versão aprovada, XML assinado validado, autorização vigente, confirmação humana e capacidade produtiva habilitada para a organização.
- **FR-041**: Timeout ou resposta ambígua após transmissão MUST resultar em estado `transmission_unknown` e consulta de estado antes de qualquer nova tentativa.

### Security, Access & Tenant Requirements *(mandatory when data/auth is affected)*

- **SEC-001**: As superfícies afetadas são aplicativo interno, portal do cliente em projeções limitadas, banco de dados, processamento backend, armazenamento privado, automações, webhooks e integração externa; o site público não participa do fluxo.
- **SEC-002**: Administradores da organização podem configurar e testar integração; gestores autorizados podem monitorar e reprocessar; colaboradores com capacidade fiscal podem consultar ou sincronizar os clientes permitidos; somente capacidades específicas podem futuramente emitir guias ou transmitir; usuários do portal e anônimos são bloqueados das operações internas.
- **SEC-003**: Toda leitura, escrita, automação, evento e chamada externa MUST estar vinculada a uma organização e, quando aplicável, a um cliente pertencente à mesma organização; nenhuma seleção apenas visual pode substituir essa validação.
- **SEC-004**: Credenciais, certificado, senha, tokens, assinatura, material de procuração e operações privilegiadas MUST permanecer exclusivamente em ambiente backend protegido e nunca ser enviados ao navegador.
- **SEC-005**: Operações executadas com privilégio de serviço MUST revalidar usuário, organização, papel, capacidade, cliente, domínio e ação antes de acessar ou alterar dados.
- **SEC-006**: O portal MUST aplicar escopo por vínculo ativo do usuário com a empresa e não pode acessar tabelas técnicas ou dados de outras empresas.
- **SEC-007**: Toda tabela exposta a usuários autenticados MUST negar acesso por padrão e aplicar políticas por organização, cliente, papel e finalidade; dados técnicos e segredos devem permanecer fora de superfícies públicas.
- **SEC-008**: Configuração, rotação, teste, sincronização manual, reprocessamento, publicação ao portal e mudança de estado operacional MUST produzir auditoria suficiente para reconstruir ator, origem, alvo, resultado e correlação.
- **SEC-009**: Mensagens de erro exibidas MUST ser compreensíveis e sanitizadas; nunca podem revelar credenciais, certificado, tokens, detalhes internos de transporte ou payload fiscal completo.
- **SEC-010**: Ambientes de desenvolvimento, validação e produção MUST possuir credenciais e certificados segregados, sendo proibido usar credenciais de produção em desenvolvimento local.

### Scalability & Performance Requirements *(mandatory for high-volume flows)*

- **PERF-001**: O desenho MUST considerar inicialmente até 5.000 clientes por organização, 20 domínios fiscais habilitáveis, 100.000 eventos ou resultados mensais e histórico operacional de 24 meses; filtros principais serão organização, cliente, domínio, competência, estado, motivo, data e ação necessária.
- **PERF-002**: Listas e painéis MUST usar paginação e filtragem no servidor; a interface pode manter somente dados limitados da página atual; sincronizações e lotes MUST ocorrer em segundo plano.
- **PERF-003**: Monitoramento MUST respeitar os limites vigentes do provedor, controlar lotes e saldo de chamadas e permitir alteração de limites sem reescrever regras fiscais.
- **PERF-004**: Consultas independentes e autorizadas podem ser executadas em paralelo somente quando isso não viola limites, ordem fiscal, idempotência ou segurança; dependências de workflow permanecem sequenciais.
- **PERF-005**: O sistema MUST evitar varredura repetitiva de todos os clientes quando evento, cache ou estado incremental puder restringir o trabalho.
- **PERF-006**: O painel MUST apresentar o estado inicial em até 2 segundos para 95% das aberturas sob a carga de referência; o aceite de uma sincronização manual MUST retornar seu estado em até 3 segundos, ainda que o processamento continue em segundo plano.

### Key Entities *(include if feature involves data)*

- **Conexão Integra Contador**: vínculo da organização com o serviço contratado, ambiente, estado, capacidades habilitadas e referências seguras de credenciais e certificado.
- **Contexto de Autorização Fiscal**: relação resolvida entre contratante, autor do pedido, contribuinte, cliente e autorização aplicável a uma capacidade fiscal.
- **Procuração Fiscal**: autorização por contribuinte, procurador, serviço, validade e estado de verificação.
- **Catálogo de Capacidade Fiscal**: definição interna e versionada de cada consulta, emissão, declaração, apoio ou monitoramento utilizado.
- **Execução de Sincronização**: processamento rastreável com cliente, domínio, motivo, estado, progresso, tentativas, correlação e resultado.
- **Estado de Evento Fiscal**: última alteração externa conhecida e último processamento por contribuinte e tópico.
- **Operação Fiscal**: ação idempotente com potencial efeito externo, seu estado, referência e resultado.
- **Resultado Fiscal Normalizado**: informação de domínio persistida em formato estável e independente do provedor.
- **Documento Fiscal**: guia, recibo, extrato, relatório, comprovante ou declaração identificado por referência externa ou hash.
- **Registro de Consumo**: metadados da chamada externa usados para custo, limites, desempenho e conciliação.
- **Revisão Fiscal**: exceção que exige decisão humana antes de alterar obrigação, tarefa, pagamento ou outro estado operacional.
- **Registro de Auditoria**: evidência de ação humana ou automática, alvo, resultado, origem e correlação.

### Data Classification *(include if feature involves data)*

- **Public**: Nenhum dado do Integra Contador é público.
- **Internal**: Estados de sincronização, métricas agregadas, tarefas, revisões, configuração não secreta e contexto operacional limitado por função.
- **Client Portal**: Guias, pagamentos, obrigações, documentos e comunicados explicitamente publicados para empresas às quais o usuário mantém vínculo ativo.
- **Sensitive/Regulated**: Dados fiscais e financeiros, CPF/CNPJ, mensagens, declarações, pagamentos, procurações, documentos, payloads, credenciais, certificados, senhas, tokens, logs técnicos correlacionáveis e informações protegidas por sigilo fiscal e LGPD.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um administrador autorizado, já de posse das credenciais e do certificado válidos, consegue cadastrá-los, validar a conexão institucional e visualizar o estado operacional ou a ação necessária em até 5 minutos, contados da abertura da configuração até a exibição do resultado, sem o sistema reexibir os segredos após o envio.
- **SC-002**: Pelo menos 95% das sincronizações elegíveis do domínio piloto concluem ou apresentam uma ação humana específica em até 15 minutos a partir da criação da solicitação, sem permanecer em estado indeterminado.
- **SC-003**: Repetições de solicitação, eventos ou trabalhos produzem zero duplicação de documentos, operações, tarefas e obrigações nos cenários de aceitação.
- **SC-004**: A situação fiscal fica disponível em p95 de até 2 segundos no teste de carga definido para o piloto, e a telemetria do piloto registra cache hit em pelo menos 90% das consultas elegíveis a reutilizar dados locais ainda válidos.
- **SC-005**: Alterações sinalizadas por monitoramento entram em processamento em até 15 minutos em 95% dos casos durante a janela operacional.
- **SC-006**: A reconciliação identifica e processa 100% dos eventos perdidos nos cenários controlados de teste dentro de 24 horas.
- **SC-007**: 100% das chamadas externas são conciliáveis por identificador de requisição, organização, cliente quando aplicável, domínio, resultado e motivo de sincronização.
- **SC-008**: Nenhum segredo, certificado, senha, token completo ou payload fiscal não sanitizado aparece no frontend, em tarefas, notificações ou logs de teste.
- **SC-009**: Para cada falha definitiva testada, o usuário recebe uma ação recomendada; para cada falha temporária elegível, o sistema respeita limite de tentativas e não gera repetição infinita.
- **SC-010**: Após adoção pelos clientes piloto, o número de acessos manuais ao e-CAC para o domínio integrado é reduzido em pelo menos 60% em até 60 dias.
- **SC-011**: Pelo menos 85% dos usuários fiscais participantes concluem os fluxos de sincronização e revisão sem treinamento adicional após uma orientação inicial de até 15 minutos.
- **SC-012**: Nenhuma tarefa é criada para eventos concluídos automaticamente; 100% das tarefas geradas nos testes possuem ação humana concreta, cliente, motivo, origem e contexto.

## Assumptions

- A Grow Finance ou a organização operadora contratará o Integra Contador e obterá credenciais e e-CNPJ compatíveis antes da validação em ambiente produtivo.
- O cenário inicial considera o escritório contábil como contratante e procurador; o cenário de software house como contratante será suportado pela arquitetura, mas só será ativado após validação jurídica e operacional do termo assinado.
- A primeira entrega é deliberadamente somente leitura e valida a fundação com um domínio piloto; operações de transmissão, apuração e emissão em lote exigirão especificações derivadas e aprovação separada.
- Caixa Postal, pagamentos e DCTFWeb são os primeiros domínios candidatos, e a seleção final do piloto ocorrerá no planejamento conforme acesso de demonstração, custo, dados de teste e dependências.
- Os módulos existentes de Clientes, Obrigações, Tarefas, Calendário, Financeiro, auditoria e permissões continuarão sendo os donos das respectivas regras operacionais.
- O módulo Integra Contador será administrativo e de monitoramento; não substituirá as filas operacionais já existentes.
- Eventos do provedor podem ficar disponíveis por janela limitada, portanto monitoramento incremental será complementado por reconciliação.
- Limites, códigos, versões, custos, serviços e procurações podem mudar; o catálogo vigente do provedor será verificado no planejamento e antes de cada expansão.
- Informações publicadas no portal passam por regra explícita de visibilidade e nunca são expostas automaticamente apenas por terem sido sincronizadas.
- A retenção de payloads e documentos observará necessidade operacional, sigilo fiscal, LGPD e política institucional a ser detalhada no planejamento.

## Scope Boundaries

### Included in this feature

- Fundação compartilhada de conexão, autenticação, autorização, procurações, catálogo, rastreabilidade, consumo, erros e simulação.
- Persistência de estado de conexão, contexto fiscal, sincronizações, eventos, consumo, auditoria, documentos e resultados normalizados necessários ao piloto.
- Um domínio piloto somente leitura com fluxo completo.
- Sincronização manual por cliente, monitoramento quando suportado e reconciliação.
- Módulo administrativo enxuto e visão fiscal contextual na ficha do cliente.
- Integração por exceção com os módulos atuais, sem criar uma segunda fila operacional.
- DCTFWeb assistida dentro da tarefa: consultas individuais, documentos e emissão individual de DARF em ambiente controlado.
- Transmissão DCTFWeb controlada por aprovação humana e feature flag, inicialmente restrita ao Trial.

### Excluded from this feature

- Implementação integral do catálogo do Integra Contador.
- Transmissão autônoma, em lote ou sem confirmação de DCTFWeb e de outras declarações.
- Apuração automática de tributos.
- Emissão massiva de DAS, DARF ou documentos de arrecadação; somente emissão individual confirmada é permitida.
- Conciliação financeira automática com efeito contábil definitivo.
- Publicação automática e irrestrita de mensagens da Receita no portal.
- Substituição dos módulos atuais de Obrigações, Tarefas, Calendário ou Financeiro.
- Uso de credenciais ou certificados de produção em desenvolvimento.

## Dependencies

- Contratação ativa e credenciais emitidas pelo SERPRO.
- Certificado e-CNPJ válido e compatível com a contratação.
- Procurações eletrônicas adequadas aos serviços utilizados.
- Cadastro confiável de organização, cliente e identificadores fiscais.
- Contratos canônicos de permissões, auditoria e mutação de tarefas/obrigações.
- Ambiente de demonstração ou provedor simulado para desenvolvimento e testes.
- Revisão da documentação oficial vigente antes do planejamento e de cada domínio derivado.
