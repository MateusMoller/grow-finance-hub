# Contexto Geral Tecnico - Grow Finance Hub

## Visao Executiva
O **Grow Finance Hub** e a plataforma web central da Grow Contabilidade para unificar operacao interna, relacionamento com clientes e presenca institucional em um unico produto. Em vez de manter processos dispersos (planilhas, trocas isoladas, controles paralelos), o sistema organiza o fluxo contabil em camadas conectadas: **site institucional** (aquisicao e posicionamento), **app interno** (execucao operacional e gestao) e **portal do cliente** (colaboracao e entrega). Referencia principal do projeto: [MateusMoller/grow-finance-hub](https://github.com/MateusMoller/grow-finance-hub).

## Objetivos do Produto
1. **Centralizacao operacional**
- Concentrar clientes, tarefas, obrigacoes, envio de arquivos (e-continuo), atendimento e relatorios em um unico ambiente operacional.
- Reduzir retrabalho e pontos cegos entre fiscal, contabil, departamento pessoal e atendimento.

2. **Padronizacao e rastreabilidade**
- Padronizar fluxo de dados cadastrais e mensais por cliente.
- Garantir historico, status e acompanhamento por modulo/setor, com rastreabilidade de execucao.

3. **Seguranca por papeis**
- Separar rigorosamente permissoes de uso entre equipes internas e usuarios de portal.
- Bloquear uso de modulos internos por perfis indevidos e preservar a segregacao de acesso por papel.

## Arquitetura Funcional por Dominio

### 1) Camada publica (institucional)
- Rotas publicas para posicionamento comercial, conteudo e conversao.
- Inclui paginas institucionais e acesso ao login do ecossistema.
- Referencia: [src/App.tsx](https://github.com/MateusMoller/grow-finance-hub/blob/main/src/App.tsx).

### 2) Camada autenticada interna (app operacional)
- Rotas sob `/app` protegidas por controle de acesso interno.
- Modulos de operacao: dashboard, kanban, calendario, clientes, relatorios, atendimento, formularios, CRM, chat interno, notificacoes, configuracoes e modulos Acessorias.
- Navegacao consolidada em sidebar por blocos de uso (Principal, Operacional, Sistema).
- Referencias:
- [src/App.tsx](https://github.com/MateusMoller/grow-finance-hub/blob/main/src/App.tsx)
- [src/components/app/AppSidebar.tsx](https://github.com/MateusMoller/grow-finance-hub/blob/main/src/components/app/AppSidebar.tsx)

### 3) Portal do cliente
- Area protegida para solicitacoes, envio/consulta de documentos, formularios, mensagens e acompanhamento.
- Possui logica propria de permissoes e experiencia orientada ao cliente final.
- Referencia: [src/pages/PortalClientePage.tsx](https://github.com/MateusMoller/grow-finance-hub/blob/main/src/pages/PortalClientePage.tsx).

## Integracoes e Regras Criticas

### Supabase como backend transacional
- O sistema usa Supabase para autenticacao, persistencia de dados e execucao de Edge Functions.
- Cliente web de integracao: [src/integrations/supabase/client.ts](https://github.com/MateusMoller/grow-finance-hub/blob/main/src/integrations/supabase/client.ts).

### Modelo de acesso e segregacao de perfis
- Papeis internos e de cliente sao normalizados e validados por regras explicitas.
- O login permite selecao de ambiente (App Interno x Portal do Cliente) e aplica validacao de permissoes antes do roteamento final.
- Referencias:
- [src/lib/accessControl.ts](https://github.com/MateusMoller/grow-finance-hub/blob/main/src/lib/accessControl.ts)
- [src/pages/LoginPage.tsx](https://github.com/MateusMoller/grow-finance-hub/blob/main/src/pages/LoginPage.tsx)

### Integracao Acessorias (obrigacoes e e-continuo)
- A integracao com Acessorias e mediada por Edge Function dedicada, com acoes de overview, sincronizacao de empresas, sincronizacao de obrigacoes e envio e-continuo.
- O modulo foi separado em dois dominios funcionais:
- **Obrigacoes**: [src/pages/ObrigacoesPage.tsx](https://github.com/MateusMoller/grow-finance-hub/blob/main/src/pages/ObrigacoesPage.tsx)
- **E-continuo**: [src/pages/EContinuoPage.tsx](https://github.com/MateusMoller/grow-finance-hub/blob/main/src/pages/EContinuoPage.tsx)
- Componente base do modulo: [src/pages/AcessoriasPage.tsx](https://github.com/MateusMoller/grow-finance-hub/blob/main/src/pages/AcessoriasPage.tsx)
- Backend da integracao: [supabase/functions/acessorias-module/index.ts](https://github.com/MateusMoller/grow-finance-hub/blob/main/supabase/functions/acessorias-module/index.ts)

### Cruzamento por CNPJ e sincronizacao automatica
- O fluxo operacional de clientes prioriza sincronizacao com Acessorias e cruzamento por CNPJ.
- O cadastro manual de empresas foi desativado no fluxo de clientes internos para manter consistencia com a fonte integrada.
- No modulo de obrigacoes, a sincronizacao foi configurada para execucao automatica no carregamento da tela (incluindo atualizacao da pagina/F5), reduzindo dependencia de gatilho manual.
- Referencias:
- [src/pages/ClientsPage.tsx](https://github.com/MateusMoller/grow-finance-hub/blob/main/src/pages/ClientsPage.tsx)
- [src/pages/AcessoriasPage.tsx](https://github.com/MateusMoller/grow-finance-hub/blob/main/src/pages/AcessoriasPage.tsx)

### PWA restrito ao escopo funcional
- O modo PWA foi limitado as rotas funcionais da aplicacao (`/app`), excluindo o escopo institucional.
- Referencia: [src/lib/pwaScope.ts](https://github.com/MateusMoller/grow-finance-hub/blob/main/src/lib/pwaScope.ts).

## Contexto Operacional de Clientes
- A area de clientes combina:
- dados gerais,
- dados mensais para relatorios gerenciais,
- dados cadastrais por setor,
- pendencias e suporte operacional.
- Inclui validacoes de entrada (ex.: CEP, telefone, percentuais, campos Sim/Nao), busca de CEP por API publica e cadastro de socios com regras de consistencia.
- Referencia: [src/pages/ClientDetailPage.tsx](https://github.com/MateusMoller/grow-finance-hub/blob/main/src/pages/ClientDetailPage.tsx).

## Estado Atual do Projeto
- **Repositorio:** [MateusMoller/grow-finance-hub](https://github.com/MateusMoller/grow-finance-hub)
- **Branch principal:** `main`
- **Commit de referencia desta leitura:** [`791cbaa`](https://github.com/MateusMoller/grow-finance-hub/commit/791cbaa)
- **Base documental e comandos tecnicos:** [README.md](https://github.com/MateusMoller/grow-finance-hub/blob/main/README.md)

## Escopo deste documento
- Este material e **descritivo** e nao altera contratos de API, schemas, tipos ou interfaces publicas do sistema.
- A evolucao continua de frontend/UX/UI pode ocorrer sem ruptura da base de negocio, desde que as regras de acesso, integracoes e fluxos criticos sejam preservados.
