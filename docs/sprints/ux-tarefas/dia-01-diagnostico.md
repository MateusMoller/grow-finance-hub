# Dia 1 — Diagnóstico de uso da tela de tarefas

Data da auditoria: 11/08/2026  
Escopo: `/app/tarefas`, visualizações Kanban e Lista  
Responsável pela análise: Codex

## Resultado executivo

A tela reúne os recursos essenciais, mas o fluxo atual perde eficiência por três causas principais:

1. todas as tarefas são carregadas do banco antes da aplicação dos filtros;
2. Lista e Kanban possuem implementações e critérios de filtro diferentes;
3. a interface expõe grande volume de cards sem uma visão inicial orientada ao trabalho prioritário.

O cenário visível de 536 itens no backlog torna esses problemas de alto impacto e alta frequência. O primeiro ciclo de melhoria deve atacar consulta/paginação, unificação dos filtros e visões rápidas antes de adicionar novos elementos visuais.

## Fluxos observados

### Fluxo 1 — Localizar uma tarefa urgente

Objetivo do usuário: encontrar o que está atrasado, vence hoje ou pertence a um cliente específico.

Situação atual:

- a busca do Kanban fica escondida dentro do painel de filtros;
- não existem atalhos visíveis para “Minhas tarefas”, “Atrasadas”, “Hoje” e “Esta semana”;
- o Kanban oferece setor, origem, prioridade e responsável, mas não oferece prazo ou status porque o status é representado pelas colunas;
- a Lista oferece apenas busca, setor e status;
- a busca e os filtros são aplicados somente depois que todas as tarefas chegam ao navegador.

Consequência: o usuário precisa conhecer os filtros, abrir o painel e varrer um volume grande antes de chegar ao trabalho prioritário.

### Fluxo 2 — Consultar e atualizar uma tarefa

Objetivo do usuário: abrir uma tarefa, compreender o contexto e alterar os campos principais.

Situação atual:

- a tarefa abre em painel lateral, preservando o quadro;
- os detalhes completos fazem uma nova consulta individual ao abrir;
- histórico e relações fazem consultas adicionais separadas;
- Lista e Kanban utilizam componentes de detalhe diferentes;
- não há indicação no card de quais alterações podem ser feitas rapidamente sem abrir o detalhe.

Consequência: o fluxo básico funciona, porém tem custo de carregamento e comportamento diferente conforme a visualização escolhida.

### Fluxo 3 — Mover e acompanhar o andamento

Objetivo do usuário: mudar o status e conferir se a alteração foi efetivamente salva.

Situação atual:

- o Kanban permite arrastar os cards;
- há validações específicas para tarefas originadas de obrigações;
- as cinco colunas permanecem abertas mesmo quando uma delas está vazia;
- a coluna de revisão vazia ocupa espaço relevante;
- o quadro possui largura mínima de 1120 px e depende de rolagem horizontal em telas menores;
- a carga inicial inclui inclusive tarefas arquivadas para administradores, embora o arquivo esteja fechado.

Consequência: a regra de negócio está protegida, mas a leitura do quadro fica dispersa e o custo de carregamento é maior que o necessário.

## Problemas priorizados

| Prioridade | Problema | Categoria | Impacto | Frequência | Evidência técnica/visual |
|---|---|---|---|---|---|
| P0 | Todas as tarefas são consultadas e filtradas no frontend | Performance/arquitetura | Muito alto | Contínua | Kanban e Lista fazem `select` sem paginação e usam `filter` local; a tela apresenta 536 itens no backlog. |
| P0 | Lista e Kanban usam consultas, filtros e normalizações diferentes | Regra/consistência | Alto | Contínua | Implementações separadas em `KanbanPage.tsx` e `TarefasPage.tsx`; a Lista consulta `*`, o Kanban usa colunas selecionadas. |
| P0 | Não há visão inicial orientada a prazo e responsabilidade | UX operacional | Alto | Diária | Não existem atalhos para Minhas, Atrasadas, Hoje e Semana. |
| P0 | Grande volume é renderizado sem paginação/virtualização | Performance/UI | Muito alto | Contínua | Todos os grupos/cards das colunas são mapeados no render. |
| P1 | Busca do Kanban fica escondida em “Filtros” | Descoberta | Médio | Alta | O campo só é renderizado quando `filtersOpen` está ativo. |
| P1 | Busca dispara atualização a cada tecla e trabalha sobre toda a coleção | Performance/interação | Médio | Alta | Estado de busca é atualizado diretamente, sem valor adiado ou debounce. |
| P1 | Lista não possui estado vazio explícito após filtros | Feedback | Médio | Média | Após o carregamento, a renderização depende de `filtered.map` sem mensagem quando o resultado é zero. |
| P1 | Filtros não são persistidos ao alternar Lista/Kanban | Continuidade | Médio | Alta | Cada visualização mantém seus próprios estados locais. |
| P1 | Colunas vazias ocupam a mesma área que colunas ativas | Hierarquia visual | Médio | Média | Revisão aparece vazia, mas mantém largura e altura completas. |
| P1 | Arquivamento automático ocorre durante o carregamento da tela | Regra/efeito colateral | Alto | Diária | A consulta inicial pode executar atualização em lote de tarefas concluídas antigas. |
| P2 | Animação da Lista cresce conforme a posição do item | Percepção de velocidade | Baixo/médio | Alta em volume | O atraso é calculado por `index * 0.04`, ficando excessivo em listas grandes. |
| P2 | Informações e controles variam entre os dois modos | Aprendizado | Médio | Alta | Lista mostra KPIs e filtros próprios; Kanban mostra outro conjunto e legenda. |

## Separação por natureza

### Interface e experiência

- busca importante escondida;
- ausência de visões rápidas;
- filtros inconsistentes entre modos;
- excesso de cards simultâneos;
- baixa utilização do espaço em colunas vazias;
- ausência de estado vazio na Lista;
- falta de persistência do contexto ao alternar a visualização.

### Performance e arquitetura

- consultas sem paginação;
- filtragem completa no frontend;
- renderização de todos os cards;
- busca sem debounce/valor adiado;
- consultas de detalhes, histórico e relações iniciadas separadamente;
- duplicação de lógica entre Lista e Kanban.

### Regra de negócio

- validações de obrigações estão concentradas no Kanban e precisam ser garantidas em qualquer forma de atualização;
- arquivamento automático é disparado pela abertura da tela, misturando leitura com alteração de dados;
- permissões por setor e visibilidade de arquivados precisam continuar preservadas na futura consulta paginada.

## Ordem recomendada de execução

1. Criar uma fonte única de consulta paginada e filtrada no backend para Lista e Kanban.
2. Unificar o modelo de filtros e persistir o estado na URL ou preferência do usuário.
3. Adicionar visões rápidas: Minhas, Atrasadas, Hoje e Esta semana.
4. Implementar carregamento progressivo/virtualização por coluna e na Lista.
5. Tornar a busca sempre acessível e aplicar debounce ou valor adiado.
6. Unificar abertura, atualização e cache do detalhe da tarefa.
7. Retirar o arquivamento automático do carregamento e movê-lo para uma rotina de backend.
8. Só então refinar densidade, colunas vazias, cards e microinterações.

## Entrega do Dia 1

O diagnóstico técnico e visual foi concluído, com três fluxos mapeados e doze problemas classificados por impacto e frequência.

## Critérios de aceite

- [x] Ao menos três fluxos reais do produto mapeados.
- [x] Problemas classificados por impacto e frequência.
- [ ] Lista validada com representantes da operação.

O terceiro critério depende de uma sessão curta com usuários da operação. Recomenda-se apresentar os itens P0 e confirmar: frequência, impacto e ordem de prioridade antes de iniciar o Dia 2.

## Limitação da auditoria

O ambiente local abriu na tela de autenticação e não havia uma sessão autenticada disponível no navegador de teste. A análise visual utilizou a captura fornecida, e a validação comportamental foi complementada pela leitura dos fluxos reais implementados no código. Nenhuma alteração funcional foi realizada neste dia, conforme o escopo de diagnóstico.
