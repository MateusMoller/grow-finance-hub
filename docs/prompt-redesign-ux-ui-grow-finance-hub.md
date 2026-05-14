# Prompt de Redesign UX/UI - Grow Finance Hub

## Como usar este material
- Copie o `Prompt Mestre` para a sua IA de design.
- Use as `Variacoes` para rodadas focadas por camada.
- Mantenha as mesmas regras de preservacao funcional em todas as rodadas.

---

## Prompt Mestre (Contexto completo)
```text
Voce e um especialista senior em Product Design, UX Strategy e UI Systems, com foco em produtos SaaS financeiros e operacionais.

Seu desafio e reimaginar o frontend do produto Grow Finance Hub com direcao visual "tech premium clean", mantendo o DNA da marca (confianca, clareza, proximidade e solidez), sem remover nenhuma funcionalidade atual.

Objetivo central:
- Modernizar a experiencia visual e de uso.
- Tornar os fluxos mais claros, fluidos e sofisticados.
- Preservar 100% das funcionalidades e regras de negocio existentes.
- Melhorar percepcao de valor, produtividade e legibilidade.

Tom visual esperado:
- Clean, sofisticado, contemporaneo, tecnologico.
- Premium sem exagero visual.
- Hierarquia clara, espacos bem resolvidos, contraste elegante.
- Evitar visual generico e "template comum".

Contexto do produto:
O Grow Finance Hub possui 3 camadas principais:
1) Camada Institucional (site publico):
- Home, Sobre, Solucoes, Contato, Newsletter e entrada para Login.
- Objetivo: aquisicao, credibilidade e conversao.

2) Camada App Interno (operacao da equipe):
- Dashboard, Kanban, Calendario, Tarefas, Clientes, Relatorios,
  Atendimento Portal, Formularios, CRM, Chat Interno, Notificacoes,
  Configuracoes, Usuarios, Sugestoes, Manual e Obrigacoes.
- Objetivo: produtividade operacional, controle e rastreabilidade.

3) Camada Portal do Cliente:
- Painel geral, Pendencias, Solicitacoes, Envios, Formularios,
  Controle de caixa, Atendimento, Manual e Configuracoes.
- Objetivo: autoatendimento, clareza de status e comunicacao com o escritorio.

Fluxos criticos que devem ser preservados:
- Filtros globais e navegacao entre modulos.
- Permissoes por papel e segregacao de acesso (interno vs cliente).
- Login com selecao de ambiente (App Interno e Portal do Cliente).
- Fluxo de Obrigacoes nativo Grow, incluindo leitura/pre-conferencia e historico.
- Fluxos de clientes, dados cadastrais/mensais e relatorios.

Principios de UX obrigatorios:
1) Hierarquia informacional objetiva (o que e mais importante aparece primeiro).
2) Menor friccao possivel em tarefas recorrentes.
3) Escaneabilidade alta (textos, status, alertas e proximas acoes).
4) Consistencia visual e comportamental entre telas.
5) Feedback claro para estados de loading, sucesso, erro, vazio e bloqueio.
6) Acessibilidade pratica (contraste, foco visivel, leitura facil, toque em mobile).

Diretrizes de navegacao:
- Institucional: fluxo orientado a conversao, com CTA claros.
- Interno: foco em produtividade, orientacao por contexto e acoes rapidas.
- Portal do cliente: linguagem simples, orientacao por "o que fazer agora".
- Garantir continuidade entre paginas sem confundir mudanca de contexto.

Diretrizes de componentes e estados:
- Definir padrao consistente para cards, tabelas, filtros, formularios, tabs, sidebars, modais e notificacoes.
- Definir comportamento visual para estados: normal, hover, focus, ativo, erro, sucesso, vazio, carregando, desabilitado.
- Evitar ruido visual em telas densas (Kanban, Clientes, Obrigacoes, Portal).

Responsividade:
- Entregar abordagem desktop-first com comportamento claro para tablet e mobile.
- Manter leitura e operacao confortavel em diferentes tamanhos de tela.
- Priorizar acao principal e contexto essencial no mobile.

Entregaveis esperados (na sua resposta):
1) Conceito visual macro da nova experiencia (1 direcao principal).
2) Arquitetura visual por camada (Institucional, Interno, Portal).
3) Sistema de estilo proposto:
   - tipografia
   - paleta
   - espacamento
   - iconografia
   - linguagem de componentes
4) Proposta de layout para telas-chave:
   - Home institucional
   - Login
   - Dashboard interno
   - Kanban
   - Clientes
   - Obrigacoes
   - Portal do cliente (painel e solicitacoes/envios)
5) Microinteracoes relevantes (transicoes, feedback, confirmacoes, progresso).
6) Rationale: justificar cada decisao visual com impacto em usabilidade, clareza e produtividade.
7) Checklist final comprovando que nenhuma funcionalidade foi perdida.

Restricoes:
- Nao simplificar removendo funcoes criticas.
- Nao alterar regras de negocio.
- Nao focar em implementacao tecnica ou codigo.
- Nao entregar algo generico; precisa refletir o contexto real do escritorio contabil.

Linguagem da resposta:
- Portugues do Brasil.
- Design-first.
- Clara, objetiva e profissional.
```

---

## Variacao Curta - Institucional
```text
Reimagine a camada institucional do Grow Finance Hub (Home, Sobre, Solucoes, Contato, Newsletter e entrada para Login) com direcao "tech premium clean".

Objetivo:
- Aumentar credibilidade, clareza de proposta de valor e conversao.
- Manter linguagem elegante, moderna e humana.

Exigencias:
- Preservar todas as funcoes atuais de navegacao e CTA.
- Melhorar storytelling visual da marca.
- Priorizar escaneabilidade, hierarquia e confianca.
- Entregar proposta de layout, sistema visual e microinteracoes.
- Justificar decisoes com impacto em conversao e experiencia.

Nao focar em codigo. Nao remover funcionalidades.
```

## Variacao Curta - App Interno
```text
Reimagine a camada de App Interno do Grow Finance Hub com foco em produtividade, controle e sofisticacao visual.

Modulos criticos a preservar:
- Dashboard, Kanban, Calendario, Tarefas, Clientes, Relatorios,
  Atendimento Portal, Formularios, CRM, Chat Interno, Notificacoes,
  Configuracoes, Usuarios, Sugestoes, Manual e Obrigacoes.

Objetivo:
- Reduzir friccao operacional.
- Melhorar leitura de status, prioridades e proximas acoes.
- Evoluir o visual para um padrao tech premium clean.

Exigencias:
- Preservar 100% das funcionalidades e fluxos.
- Propor arquitetura visual por tipos de tela (analise, lista, detalhe, execucao).
- Definir componentes e estados de feedback.
- Justificar cada decisao por ganho de usabilidade e performance cognitiva.

Nao focar em implementacao tecnica. Nao remover funcoes.
```

## Variacao Curta - Portal do Cliente
```text
Reimagine o Portal do Cliente do Grow Finance Hub com foco em clareza, autonomia e confianca.

Areas a preservar:
- Painel geral, Pendencias, Solicitacoes, Envios, Formularios,
  Controle de caixa, Atendimento, Manual e Configuracoes.

Objetivo:
- Facilitar entendimento do que esta pendente, em andamento e concluido.
- Tornar envio e acompanhamento mais intuitivos.
- Manter visual clean sofisticado com sensacao de modernidade.

Exigencias:
- Preservar todos os fluxos e funcionalidades existentes.
- Propor UX orientada a "proxima melhor acao" para o cliente.
- Melhorar comunicacao visual de status e prazos.
- Definir sistema de estados (vazio, erro, carregando, sucesso, bloqueio).
- Justificar decisoes com impacto em clareza e reducao de suporte.

Nao focar em codigo. Nao alterar regras de negocio.
```

---

## Checklist de validacao da resposta da IA de design
- Cobre as 3 camadas (institucional, interno, portal) sem omissoes.
- Declara explicitamente preservacao de funcionalidades.
- Mantem foco design-first, sem jargao tecnico de implementacao.
- Segue direcao "tech premium clean" com evolucao do DNA da marca.
- Traz rationale de UX para cada decisao visual relevante.
- Inclui responsividade e acessibilidade de forma pratica.
- Nao introduz regressao de fluxo critico.
