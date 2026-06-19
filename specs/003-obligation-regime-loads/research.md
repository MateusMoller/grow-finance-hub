# Research: Cargas Padrao de Obrigacoes por Regime Tributario

## Decision: Evoluir o modulo nativo Grow de obrigacoes

**Rationale**: O projeto ja define o fluxo oficial de obrigacoes como o modulo nativo Grow, baseado em `GrowObligationsWorkspace` e `grow-obligations-module`. As tabelas `obligation_templates`, `client_obligation_profiles` e `obligation_instances` ja cobrem catalogo mestre, vinculos por cliente e competencias. A feature deve ampliar esse dominio com cargas por regime em vez de reativar Acessorias/e-continuo ou duplicar estruturas.

**Alternatives considered**:

- Criar modulo paralelo de "cargas fiscais": rejeitado porque duplicaria catalogo, regras de geracao e historico.
- Aplicar cargas apenas no frontend: rejeitado porque deduplicacao, automacao e tenant scope precisam ser regras backend-owned.

## Decision: Catalogo mestre unico com cargas como relacao N:N

**Rationale**: A exigencia central e reutilizar a mesma obrigacao, como FGTS, em varios regimes. O modelo correto e uma obrigacao mestre unica em `obligation_templates` ligada a varias cargas por uma tabela de itens. Isso permite trocar aplicabilidade por regime sem copiar regras, documentos esperados, periodicidade ou comunicacao padrao.

**Alternatives considered**:

- Campo `regimes` direto em `obligation_templates`: rejeitado porque dificulta status por regime, aplicabilidade condicional, versionamento e auditoria.
- Duplicar templates por regime: rejeitado explicitamente pelo requisito de nao duplicar FGTS e obrigacoes compartilhadas.

## Decision: Aplicacao e reconciliacao no `grow-obligations-module`

**Rationale**: A constituicao do projeto exige regras criticas no backend. Aplicar carga cria vinculos operacionais, evita duplicidades e pode afetar competencias futuras; portanto a Edge Function deve validar usuario, organizacao, role, cliente, regime, carga ativa, duplicidade e auditoria antes de escrever em `client_obligation_profiles`.

**Alternatives considered**:

- Inserir `client_obligation_profiles` diretamente pela tela de clientes: rejeitado porque exporia regra sensivel a variacoes de UI.
- Trigger automatica no banco em `clients`: parcialmente util, mas rejeitada como unica estrategia porque mudanca de regime exige preview/confirmacao e respostas ricas para a UI.

## Decision: Aplicacao automatica em novo cliente e preview obrigatorio em cliente existente

**Rationale**: Novo cliente sem vinculos pode receber a carga automaticamente apos validacao backend. Cliente existente ou mudanca de regime precisa de preview add/keep/inactivate/review para preservar historico e evitar remocoes silenciosas.

**Alternatives considered**:

- Sempre aplicar automaticamente ao mudar regime: rejeitado por risco operacional.
- Nunca aplicar automaticamente: rejeitado porque nao resolve o ganho principal no onboarding.

## Decision: Aplicacao automatica cria vinculos, nao competencias

**Rationale**: A aplicacao automatica da carga no cadastro deve reduzir setup manual sem criar tarefas, calendario ou competencias antes de validacao operacional. A geracao de competencias continua sendo acao explicita existente do modulo de obrigacoes.

**Alternatives considered**:

- Gerar competencias do mes atual no cadastro: rejeitado porque pode criar prazos prematuros.
- Gerar mes atual e proximos meses: rejeitado porque amplia o risco operacional antes da revisao.
- Perguntar no cadastro: rejeitado para o MVP por adicionar decisao extra ao onboarding.

## Decision: Condicionais dependem de evidencia cadastral

**Rationale**: Obrigacoes condicionais variam por empregados, municipio, estado, atividade, inscricao e contratacao. O backend deve aplicar condicionais apenas quando dados do cliente indicarem aplicabilidade; sem evidencia, o item entra em revisao, nao vira vinculo automatico.

**Alternatives considered**:

- Aplicar todas as condicionais e remover depois: rejeitado por criar excesso de obrigacoes indevidas.
- Nunca aplicar condicionais automaticamente: rejeitado porque desperdicaria dados cadastrais confiaveis.

## Decision: Alteracoes publicadas em cargas ativas sincronizam clientes existentes sem alterar historico gerado

**Rationale**: A carga padrao deve manter clientes existentes atualizados, mas a sincronizacao so pode afetar vinculos ativos/futuros. Competencias, tarefas, eventos, documentos e protocolos ja gerados permanecem imutaveis para preservar rastreabilidade.

**Alternatives considered**:

- Aplicar tambem em competencias abertas ja geradas: rejeitado por risco de alterar operacao em andamento.
- Exigir reaplicacao manual para todos os clientes existentes: rejeitado pela decisao de sincronizacao automatica.
- Aplicar somente novas obrigacoes e nunca remover/inativar vinculos futuros: rejeitado porque nao reflete alteracoes completas da carga.

## Decision: Filiais usam regime proprio; heranca da matriz exige revisao

**Rationale**: Filiais podem ter regime proprio ou herdar dados da matriz. Quando ha regime proprio, a carga segue a filial. Quando o regime vem da matriz, a aplicacao deve passar por revisao para evitar copiar obrigacoes indevidas entre entidades.

**Alternatives considered**:

- Filiais nunca recebem carga automatica: rejeitado por aumentar trabalho manual.
- Filiais sempre herdam carga da matriz: rejeitado por atravessar limites operacionais entre entidades.

## Decision: Baseline fiscal com obrigacoes oficiais e itens condicionais

**Rationale**: Fontes oficiais indicam rotinas como PGDAS-D/DEFIS para Simples Nacional, DASN-SIMEI/PGMEI para MEI, DCTFWeb com MIT desde fatos geradores de 2025, e modulos SPED como ECD, ECF, EFD-Contribuicoes, EFD ICMS/IPI e EFD-Reinf. Como a obrigatoriedade varia por atividade, empregados, municipio, estado e contratacao, a carga deve suportar `required`, `optional` e `conditional`.

**Sources**:

- Gov.br DCTFWeb/MIT: https://www.gov.br/pt-br/servicos/declarar-debitos-e-creditos-tributarios-federais
- Simples Nacional PGDAS-D/DEFIS: https://www8.receita.fazenda.gov.br/simplesnacional/servicos/grupo.aspx?grp=5
- Portal SPED Receita Federal: https://sped.rfb.gov.br/
- Programas SPED Receita Federal: https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/download/sped
- Simples Nacional/MEI services: https://www8.receita.fazenda.gov.br/simplesnacional/

**Alternatives considered**:

- Marcar todas as obrigacoes como obrigatorias: rejeitado porque gera falsos positivos e carga fiscal incorreta.
- Deixar a lista para cadastro manual: rejeitado porque nao cria baseline profissional para onboarding.

## Decision: Deduplicacao por codigo, nome normalizado e vinculo unico cliente-template

**Rationale**: O banco ja possui `obligation_templates.code` unico e `client_obligation_profiles` unico por `(client_id, template_id)`. A feature deve reforcar normalizacao de nome/codigo, mostrar diagnosticos de possivel duplicidade e manter ou recriar vinculo existente como ativo quando a carga for reaplicada.

**Alternatives considered**:

- Deduplicacao por nome visual apenas: rejeitada por acentos, pontuacao e variacoes como "F.G.T.S.".
- Permitir duplicatas com merge posterior: rejeitado porque o modulo ja sofre com risco operacional e o objetivo e prevenir duplicidade.

## Decision: UX em abas densas, sem landing page

**Rationale**: O modulo de obrigacoes e operacional. A tela deve priorizar filtros, tabelas, agrupamento por regime, contadores, warnings e acoes claras, mantendo o usuario dentro de um fluxo produtivo. Deve evitar composicao de marketing, cards aninhados e listas longas sem controle.

**Alternatives considered**:

- Tela introdutoria explicativa: rejeitada por nao ser o uso primario.
- Modal unico gigante para toda a carga: rejeitado por baixa revisabilidade e risco de erro.
