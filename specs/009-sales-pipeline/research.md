# Research: Pipeline de Vendas Comercial

## Decision: Evoluir o CRM atual em vez de criar modulo paralelo

**Rationale**: A navegacao ja apresenta o modulo como "Vendas" e a rota `/app/crm` ja possui leads, metas, pipeline basico, historico e integracao com `site_leads`. Evoluir o modulo reduz duplicidade, preserva dados existentes e evita criar dois lugares para o comercial operar.

**Alternatives considered**:

- Criar nova rota `/app/vendas`: exigiria migracao de permissao, navegacao e risco de duplicar o modulo atual.
- Manter `CRMPage.tsx` sem refatorar: perpetua tela grande e dificulta adicionar produtos, atividades e detalhe robusto.

## Decision: Modelo comercial deve separar oportunidade, oferta/produto e atividade

**Rationale**: A especificacao exige vender servicos contabeis e produtos avulsos como automacoes, consultorias e sistemas. Uma oportunidade precisa apontar para um tipo de venda/oferta, enquanto atividades e follow-ups precisam ter propria linha do tempo.

**Alternatives considered**:

- Guardar tudo em `crm_leads.notes`: simples, mas nao permite filtro, metricas confiaveis, historico ou automacao futura.
- Criar apenas colunas extras em `crm_leads`: util para compatibilidade, mas insuficiente para atividades e multiplos tipos de oferta.

## Decision: Etapas do pipeline serao padrao e editaveis por administradores/gestores

**Rationale**: O comercial precisa iniciar com um funil pronto, mas a gestao precisa ajustar nomes, ordem e etapas ativas conforme o processo amadurecer. Restringir a gestao a administradores/gestores evita fragmentacao do funil por usuario.

**Alternatives considered**:

- Etapas fixas: reduz flexibilidade e gera retrabalho quando o processo comercial mudar.
- Etapas por usuario: dificulta metricas globais e padronizacao operacional.
- Etapas diferentes por tipo de venda no primeiro ciclo: aumenta complexidade antes de validar o pipeline principal.

## Decision: Catalogo comercial sera padrao, editavel por administradores/gestores, com opcao "Outro"

**Rationale**: O catalogo padroniza automacoes, consultorias, sistemas e servicos contabeis para metricas confiaveis. A opcao "Outro" permite registrar vendas fora da lista sem dar permissao ampla para qualquer usuario alterar o catalogo.

**Alternatives considered**:

- Produtos fixos: bloqueia evolucao de ofertas.
- Produto livre em todas as oportunidades: prejudica filtros e indicadores.
- Qualquer comercial criar itens de catalogo: aumenta duplicidade e nomes inconsistentes.

## Decision: Ganho de oportunidade de cliente novo criara cliente pendente e tarefa Comercial automaticamente

**Rationale**: Quando a venda e ganha, o contato passa a precisar de tratamento operacional como cliente. Criar cliente pendente e tarefa de complementacao no setor Comercial garante continuidade sem exigir cadastro completo antes da venda e sem responsavel individual obrigatorio.

**Alternatives considered**:

- Manter apenas lead ate criacao manual: risco de esquecimento e perda de controle operacional.
- Exigir cadastro completo antes de ganhar: atrasa o comercial.
- Perguntar em cada fechamento: aumenta variabilidade e risco de erro.

## Decision: Preservar `crm_leads` e mapear como oportunidades comerciais

**Rationale**: Existem dados e codigo usando `crm_leads`. O plano deve evitar apagar historico valido. A migration pode adicionar colunas e tabelas auxiliares, ou criar nova tabela `sales_opportunities` com backfill controlado, mas deve manter compatibilidade durante a transicao.

**Alternatives considered**:

- Renomear tabela diretamente: maior risco de quebra em tipos, relatorios e codigo existente.
- Criar tabela totalmente nova sem migrar: causa perda de visao historica e trabalho duplicado.

## Decision: RLS e indices por organizacao, etapa, status, responsavel, periodo e busca

**Rationale**: A feature exige 10.000 oportunidades por organizacao e filtros rapidos. O banco deve filtrar por organizacao e campos principais para nao carregar tudo no cliente.

**Alternatives considered**:

- Filtragem client-side integral: aceitavel em bases pequenas, mas viola meta de escala.
- Buscar tudo e calcular metricas no browser: aumenta custo de render e rede.

## Decision: Criacao de cliente novo deve comecar como cadastro comercial minimo

**Rationale**: O comercial precisa registrar leads rapidamente sem obrigar preenchimento operacional completo. Ao ganhar uma oportunidade, o sistema deve criar cliente pendente e tarefa de complementacao no setor Comercial.

**Alternatives considered**:

- Exigir cadastro completo de cliente antes da oportunidade: reduz velocidade comercial.
- Guardar lead sem qualquer estrutura de cliente: dificulta conversao, deduplicacao e follow-up operacional.

## Decision: Auditoria comercial deve registrar eventos e atividades com autor

**Rationale**: O produto ja exige rastreabilidade de alteracoes operacionais. Mudancas de etapa, valor, responsavel, catalogo, ganho/perda, reabertura e criacao automatica de cliente/tarefa precisam ser investigaveis.

**Alternatives considered**:

- Historico apenas visual/local: nao atende auditoria.
- Auditoria apenas em logs tecnicos: nao atende necessidade do usuario comercial.

## Decision: UI deve ser operacional, densa e limpa, nao landing page

**Rationale**: O modulo sera usado diariamente pelo comercial. A interface deve priorizar pipeline, filtros, indicadores, cards proporcionais, detalhe lateral, criacao rapida e configuracoes discretas para etapas/catalogo.

**Alternatives considered**:

- Dashboard editorial com cards grandes: desperdicaria area util.
- Tabela pura: perde leitura visual de funil.
