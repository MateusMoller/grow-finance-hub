# Feature Specification: Revisão das permissões de tarefas

**Feature Branch**: `012-review-task-permissions`

**Created**: 2026-08-12

**Status**: Draft

**Input**: User description: "Revisão completa das permissões, com análise sênior e foco principal no módulo de tarefas."

## Clarifications

### Session 2026-08-12

- Q: Como uma operação em lote deve se comportar quando contém ao menos uma tarefa proibida ou inválida? → A: Rejeitar o lote inteiro sem aplicar alterações.
- Q: A exclusão comum de uma tarefa deve removê-la fisicamente ou preservar seus dados? → A: Usar exclusão lógica, auditável e restaurável por administrador.
- Q: Como tratar mutações concorrentes sobre uma tarefa alterada desde a leitura? → A: Rejeitar por versão desatualizada e exigir recarregamento.
- Q: Por quanto tempo tarefas excluídas e auditorias devem ser mantidas? → A: Manter por 1 ano e depois permitir eliminação física.
- Q: Qual deve ser o limite máximo de uma operação em lote? → A: No máximo 100 tarefas por lote.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Acesso mínimo e previsível às tarefas (Priority: P1)

Como administrador, quero que cada usuário visualize e altere somente as tarefas permitidas por sua organização, módulo, setor e responsabilidade, para impedir exposição ou alteração indevida de dados operacionais.

**Why this priority**: Tarefas concentram dados de clientes, obrigações, documentos e comunicações. Uma divergência de escopo pode expor informações entre setores ou permitir mudanças operacionais indevidas.

**Independent Test**: Criar usuários representativos de cada papel e verificar leitura, criação, edição, movimentação, conclusão, arquivamento e exclusão em tarefas próprias, do setor, de outro setor e de outra organização.

**Acceptance Scenarios**:

1. **Given** um colaborador ativo com módulo Tarefas e setor Fiscal, **When** ele consulta o quadro, **Then** visualiza apenas tarefas fiscais da própria organização.
2. **Given** o mesmo colaborador, **When** tenta abrir ou alterar diretamente uma tarefa de outro setor ou organização, **Then** a operação é negada mesmo que o identificador seja conhecido.
3. **Given** um usuário suspenso, inativo ou com acesso em revisão, **When** tenta acessar uma tarefa por qualquer entrada do sistema, **Then** nenhuma leitura ou alteração é permitida.
4. **Given** um administrador ativo, **When** gerencia tarefas da própria organização, **Then** possui as ações administrativas definidas, sem acesso implícito a outra organização.

---

### User Story 2 - Ações compatíveis com responsabilidade e papel (Priority: P1)

Como gestor da operação, quero uma matriz clara de ações por papel para que criar, atribuir, editar conteúdo, mudar setor, concluir, arquivar e excluir não sejam tratados como uma única permissão genérica.

**Why this priority**: A permissão atual de atualização pode permitir alteração de campos sensíveis sempre que o usuário consegue acessar a linha, embora mover status e reatribuir responsabilidade tenham impactos diferentes.

**Independent Test**: Executar cada ação da matriz com administrador e colaborador, comparando resultado pela interface, acesso direto e automações.

**Acceptance Scenarios**:

1. **Given** um colaborador autorizado, **When** cria uma tarefa para outro setor, **Then** a criação segue a regra explícita e registra quem criou, setor de destino e motivo/origem.
2. **Given** um colaborador sem poder administrativo, **When** tenta excluir ou arquivar definitivamente uma tarefa, **Then** a ação é negada.
3. **Given** um colaborador com acesso à tarefa, **When** altera apenas campos operacionais permitidos, **Then** a alteração é aceita e auditada.
4. **Given** uma tentativa de mudar setor, responsável, vínculo com cliente ou origem de integração, **When** o papel não possui essa capacidade, **Then** a alteração é rejeitada integralmente.
5. **Given** um administrador autorizado, **When** exclui uma tarefa, **Then** a tarefa recebe exclusão lógica com data e autor, sai das visões operacionais e pode ser restaurada administrativamente.

---

### User Story 3 - Automações obedecem às mesmas fronteiras (Priority: P1)

Como responsável técnico, quero que WhatsApp, obrigações, Acessórias, calendário e demais integrações validem organização e tarefa antes de executar ações privilegiadas, para que uma automação não contorne as regras aplicadas aos usuários.

**Why this priority**: Operações automatizadas usam acesso privilegiado e podem ignorar as proteções normais se validarem apenas a sessão ou o módulo de origem.

**Independent Test**: Invocar cada automação com combinações válidas e inválidas de usuário, organização, tarefa, setor, cliente e integração, verificando bloqueio antes da mutação.

**Acceptance Scenarios**:

1. **Given** um usuário com acesso ao WhatsApp mas sem acesso à tarefa vinculada, **When** tenta concluir o ticket e a tarefa, **Then** a tarefa permanece inalterada e a tentativa é registrada.
2. **Given** uma integração autorizada, **When** cria ou sincroniza uma tarefa, **Then** organização, cliente, setor, origem e identificador técnico são validados e auditados.
3. **Given** uma ação automatizada repetida, **When** ela é reprocessada, **Then** não duplica tarefa nem amplia permissões.

---

### User Story 4 - Auditoria confiável e centralizada (Priority: P2)

Como auditor, quero consultar um histórico central das ações relevantes de uma tarefa, para identificar autor, origem, valores alterados, momento e resultado, independentemente do dispositivo utilizado.

**Why this priority**: Histórico somente local ou registro feito após a alteração pode ser perdido, omitido ou divergir do estado real.

**Independent Test**: Alterar uma tarefa por interface e automação, consultar o histórico em outra sessão e confirmar que sucesso e falha foram registrados com contexto suficiente.

**Acceptance Scenarios**:

1. **Given** uma mutação bem-sucedida, **When** o histórico é consultado, **Then** apresenta autor/origem, ação, antes, depois, tarefa, organização e horário.
2. **Given** uma tentativa proibida de alto risco, **When** ela é bloqueada, **Then** um evento de segurança registra a tentativa sem revelar dados da tarefa ao solicitante.
3. **Given** uma alteração que falhou, **When** o histórico é consultado, **Then** ela não aparece como sucesso.

---

### User Story 5 - Permissões compreensíveis na interface (Priority: P2)

Como usuário, quero ver apenas ações que posso executar e receber uma explicação útil quando meu acesso mudar, sem depender da interface como mecanismo de segurança.

**Why this priority**: Coerência visual reduz tentativas frustradas, mas a decisão final deve continuar protegida fora da tela.

**Independent Test**: Comparar menus, botões, atalhos, links diretos, Kanban, Lista, Calendário e painel lateral para cada perfil.

**Acceptance Scenarios**:

1. **Given** um usuário sem poder de arquivamento, **When** abre qualquer visualização da tarefa, **Then** a ação não é oferecida.
2. **Given** uma permissão revogada durante a sessão, **When** o usuário tenta a próxima ação, **Then** ela é negada e a interface atualiza o estado de acesso.
3. **Given** duas entradas para a mesma tarefa, **When** usadas pelo mesmo usuário, **Then** aplicam a mesma decisão de permissão.

### Edge Cases

- Usuário possui papel legado, mas não possui cadastro canônico de acesso ou teve esse cadastro removido.
- Usuário troca de organização durante uma sessão com dados ou consultas ainda em cache.
- Tarefa é criada para outro setor e deixa de ser visível ao próprio criador.
- Tarefa possui setor vazio, desconhecido, com grafia antiga ou codificação divergente.
- Responsável é alterado simultaneamente com setor ou organização.
- Duas sessões ou uma sessão e uma automação alteram a mesma tarefa; a primeira mutação válida incrementa a versão e as demais são rejeitadas até recarregarem o estado atual.
- Tarefa automática não possui cliente, responsável ou vínculo técnico esperado.
- Tarefa excluída logicamente ainda possui comentários, relações, anexos ou referências de integração; esses dados permanecem preservados e indisponíveis nas visões operacionais comuns.
- Uma tarefa excluída completa 1 ano de retenção; a eliminação física deve abranger dependências conforme política explícita, preservar evidência mínima do expurgo e não ocorrer por uma ação comum da interface.
- Relação conecta duas tarefas com escopos, organizações ou setores diferentes.
- Comentário é editado depois que o autor perde acesso à tarefa.
- Usuário conhece o identificador de uma tarefa inacessível e tenta acessá-la por URL, relatório, calendário, notificação ou integração.
- Duas políticas históricas sobrepostas concedem a mesma ação a públicos diferentes.
- Operação em lote contém tarefas permitidas e proibidas; a validação prévia rejeita o lote inteiro e nenhuma alteração é aplicada.
- Operação em lote contém mais de 100 tarefas; a solicitação é rejeitada antes de qualquer mutação e deve ser dividida pelo consumidor.
- Revogação de acesso ocorre enquanto uma tela, assinatura em tempo real ou automação está ativa.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST manter uma matriz única e testável para leitura, criação, edição de conteúdo, mudança de status, atribuição, mudança de setor, relacionamento, comentário, conclusão, arquivamento e exclusão de tarefas.
- **FR-002**: O sistema MUST avaliar organização, estado do acesso, revisão pendente, papel, módulo e setor antes de permitir leitura ou alteração de tarefa.
- **FR-003**: A decisão de autorização MUST ser aplicada em todas as entradas: Kanban, Lista, Calendário, painel lateral, notificações, relatórios, links diretos e integrações.
- **FR-004**: A interface MUST refletir a permissão efetiva, mas a negação MUST continuar válida quando a ação for solicitada fora da interface.
- **FR-005**: Colaboradores MUST poder criar tarefas intersetoriais somente conforme regra explícita, sem ganhar acesso posterior ao setor de destino por causa da criação.
- **FR-006**: Alterações de campos sensíveis MUST exigir capacidade específica; acesso de atualização geral não pode implicar poder de mudar organização, origem da integração, identificador técnico, cliente, setor ou responsável.
- **FR-007**: Arquivamento e exclusão lógica MUST possuir regras únicas, sem concessões legadas paralelas ou conflitantes; a exclusão lógica MUST registrar data e autor, preservar dados relacionados e permitir restauração somente administrativa.
- **FR-021**: A operação comum de exclusão MUST NOT remover fisicamente tarefas ou seus dados dependentes; qualquer política futura de eliminação física MUST ser uma rotina administrativa separada, explícita e auditada.
- **FR-008**: Comentários MUST herdar o escopo da tarefa e somente o autor autorizado pode editá-los; exclusão segue a matriz administrativa.
- **FR-009**: Relações entre tarefas MUST validar acesso aos dois lados e impedir vínculo entre organizações diferentes.
- **FR-010**: Automações MUST validar a capacidade necessária para a tarefa específica antes de usar acesso privilegiado em nome de um usuário.
- **FR-011**: Tarefas criadas ou modificadas por automação MUST registrar a origem e um identificador idempotente verificável.
- **FR-012**: Operações em lote MUST validar todas as tarefas antes da primeira mutação e ser atômicas: se qualquer item estiver proibido ou inválido, o lote inteiro MUST ser rejeitado sem aplicar alterações.
- **FR-013**: A revogação ou suspensão de acesso MUST impedir novas operações na sessão ativa sem depender de novo login.
- **FR-014**: O sistema MUST registrar histórico central e imutável das mutações relevantes e tentativas proibidas de alto risco.
- **FR-015**: O histórico MUST diferenciar sucesso, falha e negação, além de identificar autor humano ou automação.
- **FR-016**: O sistema MUST eliminar caminhos de compatibilidade legada que concedam acesso além do cadastro canônico após uma migração controlada dos usuários remanescentes.
- **FR-017**: Privilégios de banco concedidos a usuários públicos e autenticados MUST limitar-se às operações realmente necessárias e não podem oferecer operações globais fora do controle por linha.
- **FR-018**: Funções auxiliares de autorização expostas MUST validar a identidade do chamador ou não ser invocáveis diretamente por usuários finais.
- **FR-019**: Toda negação MUST retornar mensagem segura, sem confirmar existência ou conteúdo de tarefa inacessível.
- **FR-020**: O sistema MUST possuir testes automatizados de permissão por papel, setor, organização, ação, entrada e automação.
- **FR-022**: Toda mutação MUST informar a versão da tarefa lida; se a versão atual divergir, a operação MUST ser rejeitada integralmente como conflito, sem sobrescrever alterações, e o consumidor MUST recarregar o estado antes de tentar novamente.
- **FR-023**: Operações em lote e automações MUST aplicar o mesmo controle otimista; um conflito em qualquer item MUST cancelar atomicamente o lote ou evento mutante correspondente.
- **FR-024**: Tarefas excluídas logicamente, seus dados dependentes e eventos de auditoria MUST permanecer recuperáveis por 1 ano a partir da exclusão ou geração do evento; durante esse prazo, somente administrador autorizado pode restaurar tarefas.
- **FR-025**: Após 1 ano, uma rotina administrativa separada MAY eliminar fisicamente os dados elegíveis, registrando escopo, executor, horário, quantidade e resultado do expurgo sem reter o conteúdo operacional eliminado.
- **FR-026**: Uma operação em lote MUST aceitar no máximo 100 tarefas; solicitações maiores MUST ser rejeitadas integralmente antes da primeira mutação e divididas em lotes independentes pelo consumidor.

### Security, Access & Tenant Requirements *(mandatory when data/auth is affected)*

- **SEC-001**: O escopo inclui aplicativo interno, banco, funções privilegiadas, atualizações em tempo real, automações e integrações que leem ou alteram tarefas; o portal do cliente permanece somente como origem controlada de solicitações.
- **SEC-002**: Administradores gerenciam tarefas dentro da própria organização; colaboradores ativos dependem do módulo Tarefas e do setor; clientes não acessam tarefas internas diretamente.
- **SEC-003**: Toda leitura, escrita, comentário, relação, histórico e automação MUST preservar fronteira de organização e, quando aplicável, setor e cliente.
- **SEC-004**: Credenciais privilegiadas MUST existir somente em operações de backend autenticadas e autorizadas por ação e recurso.
- **SEC-005**: Mudanças de status, prioridade, prazo, descrição, cliente, setor, responsável, subtarefas, vínculos, arquivamento e exclusão MUST gerar auditoria central.
- **SEC-006**: A autorização MUST adotar negação por padrão para setor ausente/desconhecido e cadastro de acesso inexistente, salvo migração temporária formalmente monitorada.
- **SEC-007**: Políticas históricas sobrepostas MUST ser removidas; cada operação protegida deve possuir uma regra canônica claramente identificada.
- **SEC-008**: Operações globais que não respeitam filtro por linha MUST ser revogadas dos papéis de acesso da aplicação.

### Scalability & Performance Requirements *(mandatory for high-volume flows)*

- **PERF-001**: O quadro deve suportar ao menos 10.000 tarefas por organização, filtradas principalmente por organização, status, setor, responsável, cliente, competência, vencimento e origem.
- **PERF-002**: Listas MUST usar consulta limitada, filtragem antes da entrega e carregamento incremental; regras de acesso não podem depender de baixar dados proibidos para filtrá-los na tela.
- **PERF-003**: Para 95% das interações, tarefas permitidas devem aparecer em até 2 segundos e uma mudança de status deve confirmar sucesso ou negação em até 1 segundo, sob volume operacional esperado.
- **PERF-004**: Verificações de autorização em lote e automações MUST evitar consultas repetitivas por tarefa quando o mesmo escopo puder ser validado de forma agrupada e segura.

### Key Entities *(include if feature involves data)*

- **Acesso organizacional**: Papel primário, estado, revisão pendente, setor e módulos concedidos a um usuário dentro de uma organização.
- **Tarefa**: Unidade operacional com organização, setor, cliente, responsável, origem, status, prioridade, prazo e vínculos técnicos.
- **Capacidade**: Ação específica permitida sobre uma tarefa ou conjunto de tarefas.
- **Comentário de tarefa**: Comunicação interna subordinada ao escopo da tarefa e ao autor.
- **Relação de tarefas**: Vínculo entre duas tarefas acessíveis da mesma organização.
- **Evento de auditoria**: Registro central de tentativa ou mutação, com autor/origem, resultado e mudanças relevantes.
- **Ator de automação**: Integração identificável que executa uma ação com finalidade e escopo definidos.

### Data Classification *(include if feature involves data)*

- **Public**: Nenhum dado de tarefa.
- **Internal**: Títulos, status, responsáveis, comentários, relações, histórico e dados operacionais.
- **Client Portal**: Somente solicitações e documentos explicitamente destinados ao cliente; tarefas internas não são expostas diretamente.
- **Sensitive/Regulated**: Identificação de clientes, informações fiscais, contábeis, trabalhistas, documentos, conversas e metadados de integrações vinculados às tarefas.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das combinações da matriz de papel, setor, organização e ação produzem o mesmo resultado na interface, acesso direto e automações.
- **SC-002**: Nenhum usuário de teste acessa ou altera tarefa de outra organização ou setor não autorizado em uma bateria com pelo menos 100 cenários negativos.
- **SC-003**: 100% das exclusões, arquivamentos e mudanças de campos sensíveis possuem uma única regra canônica e um evento de auditoria correspondente.
- **SC-004**: 100% das automações que alteram tarefas comprovam autorização para organização e tarefa específica antes da mutação.
- **SC-005**: Revogações e suspensões bloqueiam novas ações em até 60 segundos, inclusive em sessões já abertas.
- **SC-006**: Pelo menos 95% das consultas comuns do módulo apresentam dados permitidos em até 2 segundos com 10.000 tarefas na organização.
- **SC-007**: Usuários representativos concluem os fluxos permitidos sem encontrar ações que terminem em negação inesperada em pelo menos 90% dos testes de usabilidade.
- **SC-008**: A revisão final não encontra operação global concedida aos papéis da aplicação nem política legada que amplie uma regra canônica.

## Assumptions

- O cadastro canônico de acesso organizacional é a fonte oficial de papéis, módulos e setores.
- O papel administrativo continua restrito à organização ativa, sem superadministração implícita entre organizações.
- Colaboradores podem criar tarefas para outros setores, mas não visualizá-las depois se o setor de destino não estiver autorizado.
- Exclusão de tarefa e comentário permanece administrativa; conclusão e movimentação operacional podem ser concedidas a colaboradores autorizados.
- O escopo desta especificação é diagnosticar e definir a correção; a implementação será planejada em etapa posterior.
- Dados e funções legadas serão migrados antes da remoção definitiva de compatibilidade.

## Senior Review Findings

### Critical

1. **Política de exclusão legada sobreposta**: existe uma regra canônica de exclusão administrativa e, simultaneamente, uma política antiga que concede exclusão a papéis legados de direção e gestão. Políticas permissivas se somam, portanto a regra mais ampla continua efetiva e diverge da interface, que apresenta arquivamento apenas ao administrador.
2. **Privilégios globais excessivos**: papéis público e autenticado possuem privilégios de tabela além do CRUD necessário, incluindo operação global que não é filtrada pelas regras por linha. Mesmo quando o caminho HTTP comum não oferece essa operação, o princípio de menor privilégio não está atendido.
3. **Função privilegiada de tarefa executável sem autenticação**: o verificador oficial de segurança identificou que uma função legada de acesso por setor usa privilégios elevados e pode ser chamada pelo papel anônimo. Isso permite sondar decisões internas de autorização e amplia desnecessariamente a superfície pública.

### High

4. **Automações podem contornar o escopo da tarefa**: fluxos privilegiados, como conclusão de ticket do WhatsApp, validam acesso ao módulo de origem e depois alteram a tarefa com credencial administrativa. Falta comprovar que o usuário pode executar a ação naquela tarefa específica.
5. **Atualização é ampla por linha, não por ação/campo**: quem pode atualizar uma tarefa acessível pode tentar alterar todos os campos graváveis. Regras de atribuição, setor, cliente, origem técnica, status e conteúdo precisam ser separadas.
6. **Compatibilidade legada reabre acesso**: quando não há cadastro canônico, funções de autorização consultam papéis antigos. Um usuário removido do modelo novo pode continuar autorizado pelo legado, dificultando revogação definitiva e auditoria.

### Medium

7. **Auditoria ainda possui caminhos frágeis**: há histórico central, porém algumas alterações são registradas pela aplicação após a mutação e erros de auditoria são apenas avisados. Isso permite mudança bem-sucedida sem evidência correspondente.
8. **Funções de autorização aceitam identidade informada pelo chamador**: funções privilegiadas expostas recebem um identificador de usuário arbitrário. O uso nas políticas é correto, mas a chamada direta permite sondar decisões de acesso em nome de terceiros.
9. **Relações podem ser removidas por qualquer usuário com acesso aos dois lados**: não há distinção entre autor, responsável e administrador para desfazer vínculos operacionais.
10. **Criação intersetorial pode produzir tarefa invisível ao criador**: a regra é útil, porém precisa de confirmação clara, seleção válida de responsável do destino e auditoria para evitar tarefas órfãs.
11. **Escopo é duplicado em várias camadas**: normalização de setor e decisão de acesso existem no frontend e no banco. Já há divergências históricas de nomenclatura, aumentando risco de UX inconsistente e testes insuficientes.

### Recommended Sequence

1. Remover políticas sobrepostas e privilégios globais excessivos.
2. Criar matriz de capacidades por ação e cobri-la com testes negativos.
3. Exigir autorização por tarefa em todas as funções privilegiadas.
4. Centralizar mutações sensíveis e auditoria atômica.
5. Migrar e desligar o fallback legado com relatório de usuários afetados.
6. Alinhar todas as entradas visuais à mesma resposta de capacidade.
7. Adicionar monitoramento de negações, automações e tentativas interorganizacionais.
