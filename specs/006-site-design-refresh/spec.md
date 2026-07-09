# Feature Specification: Site Design Refresh

**Feature Branch**: `006-site-design-refresh`

**Created**: 2026-07-03

**Status**: Draft

**Input**: User description: "Crie uma especificação focada em design do site, quero que você faça ele ficar mais bonito sem atrapalhar as funcionalidades, use sites profissionais como referencia, quero uma aparência minimalista, profissional, que passe um tom de segurança, mantenha a palheta de cores atual, mas pode ficar livre para modificar a estilização completa."

## Clarifications

### Session 2026-07-03

- Q: Qual rota deve ser tratada como página principal do site público? -> A: Manter `/` como página principal institucional e tratar `/inicio` como página complementar.
- Q: Qual direção visual deve guiar imagens e elementos principais? -> A: Priorizar fotos reais/institucionais e usar visual minimalista quando não houver imagem aprovada.
- Q: Qual ação deve ter maior prioridade visual no site público? -> A: Priorizar contato/agendamento como CTA principal; login/portal como ações secundárias.
- Q: Qual liberdade existe para ajustar textos do site público? -> A: Reescrever levemente títulos e textos para clareza, sem criar novas promessas ou métricas.
- Q: Qual nível de animação deve ser usado no redesign? -> A: Usar animações discretas apenas para entrada, hover e transições suaves.
- Q: O redesign deve incluir apenas o site público ou também áreas internas? -> A: Incluir também módulos internos e portal do cliente, somente em design, sem interferir em funcionalidades.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Primeiro impacto profissional e seguro (Priority: P1)

Como visitante do site público da Grow, quero perceber rapidamente que a empresa é profissional, confiável e organizada, para me sentir seguro ao conhecer seus serviços e avançar para contato.

**Why this priority**: A primeira impressão do site influencia credibilidade, percepção de segurança e intenção de contato. O redesign precisa melhorar o valor visual sem quebrar a navegação existente.

**Independent Test**: Pode ser testado acessando a página inicial e verificando se a hierarquia visual comunica marca, proposta de valor, segurança e caminhos de ação sem exigir leitura extensa ou busca por informações básicas.

**Acceptance Scenarios**:

1. **Given** um visitante acessando o site pela primeira vez, **When** a página inicial carregar, **Then** ele deve identificar em até 5 segundos a marca, o posicionamento da Grow e o principal caminho de contato.
2. **Given** um visitante avaliando confiança, **When** ele percorrer a primeira dobra e as primeiras seções, **Then** o design deve transmitir organização, segurança e maturidade profissional por meio de composição minimalista, espaçamento consistente, tipografia legível e uso controlado da paleta atual.
3. **Given** um visitante em dispositivo móvel, **When** ele abrir a página inicial, **Then** o conteúdo principal deve permanecer legível, sem sobreposição visual, cortes indevidos ou necessidade de zoom.

---

### User Story 2 - Navegação comercial mais clara (Priority: P2)

Como potencial cliente, quero navegar pelas páginas e seções comerciais com clareza, para entender os serviços, diferenciais e formas de contato sem me perder.

**Why this priority**: O redesign deve melhorar a experiência de decisão sem remover ou ocultar funcionalidades existentes, especialmente chamadas para contato, informações institucionais e páginas de conteúdo.

**Independent Test**: Pode ser testado percorrendo as páginas públicas principais e verificando se o visitante consegue entender a estrutura do site, localizar serviços e chegar ao contato sem ambiguidade.

**Acceptance Scenarios**:

1. **Given** um visitante procurando serviços contábeis, **When** ele navegar pela área de soluções ou serviços, **Then** os serviços devem aparecer em blocos claros, escaneáveis e visualmente consistentes.
2. **Given** um visitante pronto para entrar em contato, **When** ele estiver em qualquer página pública principal, **Then** deve haver um caminho evidente para contato ou conversão sem interromper a leitura.
3. **Given** uma página pública com conteúdo mais longo, **When** o visitante rolar a página, **Then** a hierarquia de títulos, textos, seções e chamadas deve facilitar leitura progressiva sem excesso visual.

---

### User Story 3 - Consistência visual em todo o site público (Priority: P3)

Como gestor da Grow, quero que o site público tenha uma identidade visual consistente, minimalista e premium, para que a marca pareça mais sólida sem exigir mudanças no funcionamento dos sistemas existentes.

**Why this priority**: A consistência visual reduz percepção de improviso e facilita manutenção futura, mas depende de preservar os fluxos já existentes.

**Independent Test**: Pode ser testado comparando páginas públicas principais e verificando se cores, espaçamentos, botões, cards, formulários, navegação e rodapé seguem a mesma linguagem visual.

**Acceptance Scenarios**:

1. **Given** um visitante alternando entre páginas públicas, **When** ele acessar páginas institucionais, comerciais, contato e conteúdo legal, **Then** todas devem manter linguagem visual consistente e alinhada à paleta atual.
2. **Given** um formulário ou chamada para ação existente, **When** o redesign for aplicado, **Then** a funcionalidade deve permanecer disponível e reconhecível, com aparência mais clara e profissional.
3. **Given** uma página com estados vazios, erros ou carregamento, **When** esses estados aparecerem, **Then** eles devem seguir o mesmo padrão visual minimalista e confiável.

---

### User Story 4 - Interface interna mais profissional sem mudar fluxos (Priority: P4)

Como usuário interno ou cliente autenticado, quero usar os módulos do sistema com uma aparência mais organizada, moderna e consistente, para trabalhar com mais clareza sem perder nenhum fluxo, dado, permissão ou comportamento já existente.

**Why this priority**: O app interno e o portal concentram a operação diária. Melhorar o design dessas áreas aumenta percepção de qualidade e eficiência, mas deve ter prioridade posterior ao site público porque qualquer alteração funcional indevida impacta operação.

**Independent Test**: Pode ser testado navegando pelos principais módulos internos e pelo portal do cliente, verificando se a aparência ficou mais consistente e profissional sem alterar permissões, filtros, dados, botões, formulários, tabelas, ações ou estados existentes.

**Acceptance Scenarios**:

1. **Given** um usuário interno acessando módulos operacionais, **When** navegar entre dashboard, clientes, tarefas, calendário, CRM, relatórios, financeiro, obrigações, usuários, notificações e configurações, **Then** a interface deve manter todos os fluxos existentes e apresentar linguagem visual mais consistente.
2. **Given** um usuário do portal do cliente, **When** acessar suas telas autenticadas, **Then** a experiência visual deve ficar alinhada à marca sem expor dados indevidos ou alterar escopo de acesso.
3. **Given** uma tela interna com tabelas, filtros, formulários ou estados vazios, **When** o redesign for aplicado, **Then** a legibilidade, hierarquia e espaçamento devem melhorar sem mudar regras de negócio, validações ou ações disponíveis.

---

### Edge Cases

- Em telas pequenas, textos longos, botões e seções devem quebrar linha de forma natural, sem sobrepor elementos ou gerar rolagem horizontal.
- Caso uma imagem, ícone ou elemento visual não carregue, a página deve continuar compreensível e navegável.
- Páginas com pouco conteúdo não devem parecer incompletas; devem usar espaçamento e composição para manter aparência intencional.
- Páginas com muito conteúdo não devem parecer densas ou confusas; devem usar seções, hierarquia e ritmo visual para facilitar leitura.
- O redesign não deve ocultar links legais, informações institucionais, formulários, botões de contato ou caminhos existentes de autenticação.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O site público MUST manter todas as funcionalidades existentes disponíveis após o redesign, incluindo navegação, chamadas para contato, formulários, links institucionais, páginas legais e caminhos de acesso.
- **FR-001a**: A rota `/` MUST permanecer como página principal institucional do site público; a rota `/inicio` MUST ser mantida como experiência complementar sem substituir ou redirecionar a página principal.
- **FR-002**: O redesign MUST preservar a paleta de cores atual como base da identidade visual, permitindo ajustes de contraste, intensidade, fundos, bordas e estados visuais para melhorar sofisticação e legibilidade.
- **FR-003**: O site público MUST adotar aparência minimalista, profissional e segura, com uso controlado de elementos decorativos, composição limpa, contraste adequado e tipografia consistente.
- **FR-004**: A página inicial MUST apresentar marca, proposta de valor, confiança institucional e ação principal de forma clara na primeira dobra.
- **FR-005**: As páginas públicas principais MUST seguir um sistema visual consistente para cabeçalho, rodapé, seções, botões, cards, formulários, estados interativos e mensagens.
- **FR-006**: O redesign MUST melhorar a leitura em desktop, tablet e mobile, garantindo que textos, botões, imagens e blocos não fiquem cortados, sobrepostos ou desalinhados.
- **FR-007**: Os elementos visuais MUST transmitir segurança e maturidade profissional, evitando aparência informal, excesso de gradientes, excesso de efeitos ou composição genérica.
- **FR-008**: Referências visuais profissionais MAY orientar qualidade, densidade, hierarquia, ritmo e acabamento, mas o resultado MUST permanecer próprio da marca Grow.
- **FR-008a**: Imagens principais e elementos visuais de confiança MUST priorizar fotos reais ou institucionais aprovadas; quando não houver imagem aprovada, o redesign MUST usar composição minimalista com tipografia, cards, ícones e superfícies, evitando imagem decorativa genérica.
- **FR-009**: Todas as chamadas para ação existentes MUST permanecer fáceis de encontrar e visualmente destacadas sem competir com o conteúdo principal.
- **FR-009a**: Chamadas para contato ou agendamento MUST ter prioridade visual principal nas páginas públicas; login e portal MUST permanecer disponíveis como ações secundárias claras.
- **FR-010**: O redesign MUST manter acessibilidade básica de leitura e interação, incluindo contraste suficiente, foco visual perceptível, áreas clicáveis confortáveis e texto legível.
- **FR-011**: O site público MUST manter clareza de conteúdo para visitantes que buscam serviços, informações institucionais, contato ou acesso ao ambiente autenticado.
- **FR-012**: O redesign MUST evitar claims, métricas, selos, depoimentos ou afirmações institucionais sem suporte em conteúdo aprovado.
- **FR-013**: Títulos e textos públicos MAY ser levemente reescritos para melhorar clareza, escaneabilidade e tom profissional, mas MUST NOT criar novas promessas, métricas, garantias, depoimentos ou afirmações comerciais sem aprovação.
- **FR-014**: Animações MAY ser usadas apenas de forma discreta para entradas, hovers e transições suaves; o redesign MUST avoid animações pesadas, distrativas ou que prejudiquem leitura, performance ou sensação de segurança.

- **FR-015**: O redesign MUST incluir também o app interno e o portal do cliente em nível visual, mantendo todos os módulos, rotas, dados, permissões, formulários, filtros, ações, validações e fluxos operacionais existentes.
- **FR-016**: Telas internas com alta densidade operacional MUST priorizar clareza, escaneabilidade, hierarquia, responsividade e eficiência de uso, evitando estilo de landing page, excesso decorativo ou redução de informação útil.
- **FR-017**: O redesign dos módulos internos MUST preservar estados existentes de carregamento, erro, vazio, sucesso, permissões insuficientes e ações bloqueadas, alterando apenas apresentação visual.

### Security, Access & Tenant Requirements *(mandatory when data/auth is affected)*

- **SEC-001**: As superfícies afetadas MUST ser identificadas como site público, app interno e portal do cliente.
- **SEC-002**: A feature MUST NOT alterar papéis, permissões, autenticação, limites entre organizações, acesso ao portal do cliente, acesso ao app interno ou dados operacionais protegidos.
- **SEC-003**: Formulários públicos e fluxos de contato existentes MUST preservar o comportamento atual de tratamento de dados e o contexto legal/consentimento visível.
- **SEC-004**: Credenciais sensíveis, operações privilegiadas e dados protegidos MUST permanecer fora do escopo do redesign visual.
- **SEC-005**: Se formulários públicos existentes exibirem mensagens de sucesso ou erro, o redesign MUST preservar feedback claro ao usuário sem expor detalhes técnicos internos.
- **SEC-006**: O redesign do app interno e portal MUST preservar todas as regras de visibilidade, menus, bloqueios por permissão e escopo de dados já existentes.

### Scalability & Performance Requirements *(mandatory for high-volume flows)*

- **PERF-001**: Páginas públicas MUST permanecer rápidas o suficiente para que visitantes percebam o conteúdo inicial rapidamente em conexões comuns de desktop e mobile.
- **PERF-002**: O redesign MUST evitar peso visual excessivo que atrase o acesso ao conteúdo central ou às ações principais.
- **PERF-003**: Critérios de sucesso MUST incluir metas mensuráveis de estabilidade visual e usabilidade para páginas públicas em desktop e mobile.
- **PERF-004**: Módulos internos de alto volume MUST manter densidade operacional e performance percebida; o redesign MUST NOT adicionar elementos visuais que atrasem filtros, tabelas, listas, formulários ou fluxos recorrentes.

### Key Entities *(include if feature involves data)*

- **Página pública**: Uma área acessível sem autenticação, como página inicial, soluções/serviços, institucional, contato, conteúdo e páginas legais.
- **Módulo interno**: Uma área autenticada de operação, como dashboard, clientes, tarefas, calendário, CRM, relatórios, financeiro, obrigações, usuários, notificações, sugestões, manual de uso ou configurações.
- **Tela do portal do cliente**: Uma área autenticada e limitada ao cliente, usada para consulta, acompanhamento ou interação com dados e documentos já autorizados.
- **Seção visual**: Uma área de conteúdo com propósito claro, como primeira dobra, serviços, sinais de confiança, explicação de processo, bloco de contato, rodapé ou conteúdo legal.
- **Chamada para ação**: Uma ação visível que guia visitantes para contato, exploração de serviços ou acesso autenticado.
- **Elemento de estilo da marca**: Tratamento visual reutilizável para tipografia, espaçamento, cor, bordas, botões, cards, ícones, imagens e estados interativos.

### Data Classification *(include if feature involves data)*

- **Public**: Marketing copy, institutional content, public navigation, contact calls, public legal content and visual assets.
- **Internal**: Authenticated operational UI visible to authorized internal roles; included for visual redesign only, without changing data access, permissions, filters, actions or business rules.
- **Client Portal**: Authenticated client-scoped UI; included for visual redesign only, without changing access scope, available data, document visibility or client interactions.
- **Sensitive/Regulated**: May remain visible only where already authorized today; the redesign must not expose, duplicate, move into broader contexts, or change handling of financial, fiscal, labor, identity, document, credential, AI, WhatsApp, Open Finance or Acessorias data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 90% das páginas públicas revisadas passam em checklist visual de alinhamento, espaçamento, contraste, responsividade e ausência de sobreposição.
- **SC-002**: Um visitante de primeira viagem consegue identificar a empresa, entender a oferta principal e localizar um caminho de contato em até 5 segundos na página inicial.
- **SC-003**: Todas as páginas públicas principais permanecem utilizáveis sem rolagem horizontal em larguras comuns de mobile, tablet e desktop.
- **SC-004**: Todos os links de navegação pública, caminhos de contato e links de acesso existentes permanecem disponíveis após o redesign.
- **SC-005**: Pelo menos 95% dos textos visíveis nas páginas públicas atendem expectativas de legibilidade em tamanho, contraste e comprimento de linha durante revisão manual.
- **SC-006**: Nenhuma mudança do redesign aumenta o número de etapas necessárias para chegar ao contato ou ao acesso autenticado a partir da página inicial pública.
- **SC-007**: A revisão de stakeholders classifica o site atualizado como profissional, minimalista e seguro em tom antes da feature ser considerada completa.
- **SC-008**: 90% das telas internas e do portal revisadas passam em checklist visual de alinhamento, espaçamento, contraste, responsividade, legibilidade e ausência de sobreposição.
- **SC-009**: Nenhuma mudança visual aumenta o número de etapas para concluir fluxos operacionais centrais em Clientes, Tarefas, Calendário, Relatórios, Obrigações, Financeiro ou Portal do Cliente.
- **SC-010**: Nenhuma rota, menu, ação ou dado protegido aparece para usuários sem autorização após o redesign.

## Assumptions

- O escopo inclui site público, app interno e portal do cliente, mas apenas para redesign visual e melhoria de consistência.
- O redesign não altera permissões, estrutura de dados, backend, automações, integrações, sincronizações, RLS, Storage, Edge Functions ou regras de negócio.
- O conteúdo existente pode ser levemente reorganizado para clareza, mas novos claims factuais, métricas ou depoimentos exigem fonte aprovada.
- Em módulos internos e no portal, textos operacionais, nomes de campos, ações e mensagens devem permanecer como estão, salvo ajustes mínimos de clareza que não mudem regra, fluxo ou interpretação.
- A paleta atual da marca permanece como base; o redesign pode ajustar tons, contraste, fundos, bordas e estados de interação.
- O site deve parecer moderno e profissional sem depender de excesso decorativo, animações pesadas ou efeitos comerciais densos.
- Rotas funcionais, formulários, links e caminhos de acesso existentes permanecem como base e não devem ser removidos.
- O redesign deve considerar desktop e mobile desde o início, com igual prioridade para leitura e confiança.
