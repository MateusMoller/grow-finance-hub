# Memorial Descritivo do Projeto - Grow Finance Hub

## 1. Identificacao do projeto

O Grow Finance Hub e uma plataforma web desenvolvida para centralizar a operacao digital da Grow Contabilidade, integrando em um unico ambiente o site institucional, o aplicativo interno de gestao e o portal do cliente.

O projeto tem como finalidade organizar os fluxos operacionais, comerciais, financeiros e documentais da empresa, reduzindo controles paralelos e aumentando a rastreabilidade das atividades executadas por equipes internas e clientes.

## 2. Objetivo geral

O objetivo do Grow Finance Hub e oferecer uma solucao web unica para:

- apresentar a Grow Contabilidade ao publico externo;
- captar leads e contatos comerciais;
- autenticar usuarios internos e clientes;
- controlar clientes, tarefas, obrigacoes, calendario, CRM, relatorios, financeiro e comunicacoes;
- disponibilizar um portal seguro para o cliente acompanhar solicitacoes, documentos, mensagens e informacoes relevantes;
- preservar regras de acesso, segregacao de dados e controle operacional por perfil, modulo e organizacao.

## 3. Escopo funcional

O sistema e organizado em tres camadas principais.

### 3.1 Site publico

A camada publica contempla as paginas institucionais e de conversao, acessiveis sem autenticacao. Inclui rotas como pagina inicial, sobre, solucoes, contato, newsletter, privacidade, termos de uso e redirecionamentos para login.

Essa camada tem foco em comunicacao institucional, captacao de oportunidades e orientacao do usuario para os ambientes autenticados.

### 3.2 Aplicativo interno

O aplicativo interno e acessado por rotas protegidas em `/app/*` e concentra a operacao da empresa. Os principais modulos sao:

- Dashboard;
- Calendario;
- Tarefas e Kanban;
- Clientes e detalhe cadastral;
- Formularios;
- CRM;
- Chat interno;
- Newsletter administrativa;
- Relatorios;
- Financeiro;
- Obrigacoes;
- Notificacoes;
- Usuarios;
- Sugestoes;
- Manual de uso;
- Configuracoes.

O acesso a esses modulos e controlado por autenticacao, papeis internos, permissoes de modulo e flags de funcionalidades da organizacao.

### 3.3 Portal do cliente

O portal do cliente e uma area autenticada com escopo proprio, destinada a usuarios com perfil de cliente. Seu objetivo e oferecer uma experiencia separada do aplicativo interno, preservando isolamento de dados e evitando exposicao de informacoes operacionais sensiveis.

O portal contempla visao geral, acoes rapidas, mensagens, solicitacoes, documentos e recursos associados ao relacionamento entre a Grow e o cliente.

## 4. Arquitetura tecnica

O projeto e uma aplicacao web baseada nas seguintes tecnologias:

- Vite como ferramenta de build e desenvolvimento;
- React 18 com TypeScript;
- React Router para roteamento;
- TanStack Query para cache, deduplicacao e gerenciamento de estado remoto;
- Tailwind CSS para estilos;
- shadcn/Radix UI como base de componentes acessiveis;
- lucide-react para iconografia;
- Supabase como backend principal, cobrindo autenticacao, banco de dados, storage, realtime e Edge Functions.

O frontend utiliza carregamento sob demanda de paginas por `React.lazy`, reduzindo o custo inicial de carregamento entre site publico, app interno e portal.

## 5. Backend, dados e integracoes

O Supabase e o backend transacional do projeto. Ele concentra:

- autenticacao de usuarios;
- perfis, papeis e permissoes;
- tabelas operacionais;
- politicas de Row Level Security;
- funcoes de borda para integracoes sensiveis;
- buckets de arquivos e midias;
- webhooks e automacoes.

As Edge Functions sao utilizadas para operacoes que nao devem ocorrer diretamente no frontend, como integracoes com servicos externos, uso de segredos, envio de e-mails, webhooks, gerenciamento de usuarios, integracoes financeiras, assistente de IA e processamento de documentos.

Entre as integracoes previstas ou presentes no projeto estao:

- Resend para e-mails de contato, newsletter e obrigacoes;
- WhatsApp e webhooks de comunicacao;
- Open Finance;
- Acessorias, tratado como integracao operacional e legado compatibilizado;
- OpenAI ou servicos de IA por meio de funcoes backend;
- GitHub para fluxos especificos de processos/documentos;
- Push notifications para o PWA.

## 6. Modulos operacionais principais

### 6.1 Clientes

O modulo de clientes centraliza dados gerais, informacoes cadastrais, dados mensais, pendencias e relacao operacional com a contabilidade. O fluxo prioriza consistencia cadastral, validacoes de entrada e sincronizacao com fontes integradas quando aplicavel.

### 6.2 Tarefas, Kanban e calendario

O sistema organiza atividades operacionais em tarefas, listas, status, responsaveis, setores, prazos e visualizacoes de acompanhamento. O calendario apoia a visao temporal das demandas.

### 6.3 Obrigacoes

O modulo nativo Grow de obrigacoes e a referencia atual para catalogo, vinculos de clientes, cargas por regime tributario, documentos e fluxos de acompanhamento. Fluxos antigos de Acessorias/e-continuo sao mantidos como compatibilidade ou redirecionamento, mas novas evolucoes devem priorizar o modulo nativo.

As regras sensiveis de obrigacoes, como normalizacao de regimes, deduplicacao, aplicabilidade condicional e sincronizacao de cargas publicadas, devem permanecer no backend e no banco de dados, nao apenas na interface.

### 6.4 Relatorios

O modulo de relatorios permite trabalhar com bases como clientes, leads/CRM, tarefas e equipe. Modelos salvos e exportacoes devem respeitar classificacao de dados, escopo organizacional, permissoes e validacoes de catalogo.

### 6.5 CRM e newsletter

O CRM apoia a gestao de leads, contatos e oportunidades. A newsletter complementa a comunicacao ativa, com administracao interna e envio por integracoes backend.

### 6.6 Financeiro

O modulo financeiro e uma area sensivel e deve permanecer restrito a papeis autorizados. Alteracoes nesse dominio devem preservar controle de acesso e evitar exposicao indevida de dados.

### 6.7 Manual, sugestoes e configuracoes

O manual de uso, sugestoes e configuracoes complementam a governanca do produto, ajudando usuarios internos a operar o sistema e permitindo ajustes controlados da experiencia.

## 7. Controle de acesso e seguranca

O projeto possui segregacao entre:

- usuarios internos;
- usuarios clientes;
- rotas publicas;
- modulos internos;
- funcionalidades condicionadas por permissao;
- dados protegidos por escopo e organizacao.

Os papeis internos incluem perfis como admin, director, manager, employee, commercial, partner, departamento_pessoal, fiscal e contabil. O papel de cliente e tratado separadamente.

As regras de seguranca devem ser aplicadas em camadas:

- protecao de rota no frontend;
- verificacao de perfil e escopo no frontend;
- validacao em Edge Functions;
- politicas RLS no banco;
- controle de buckets e arquivos no Supabase Storage;
- uso seguro de segredos apenas no backend;
- auditoria e evidencias em documentos de seguranca.

Restricoes apenas visuais nao sao consideradas controle de seguranca suficiente.

## 8. PWA e experiencia de uso

O projeto possui comportamento de PWA limitado ao escopo funcional da aplicacao. O modo instalado deve direcionar o usuario para as rotas operacionais protegidas, evitando que a experiencia institucional publica se misture ao uso interno.

O design da aplicacao prioriza interface operacional, navegacao por sidebar, componentes consistentes, estados de carregamento e separacao clara entre site publico, app interno e portal do cliente.

## 9. Implantacao e ambientes

O projeto esta preparado para build estatico e deploy em plataformas como GitHub Pages, Netlify e Vercel. A aplicacao depende de variaveis de ambiente para conexao com Supabase e recursos complementares.

Comandos principais:

```bash
npm run dev
npm run lint
npm run test
npm run build
npm run verify:deploy
```

O ambiente recomendado exige Node.js compativel com as versoes atuais do Vite, Vitest e demais dependencias do projeto.

## 10. Manutencao e evolucao

Evolucoes futuras devem respeitar os seguintes principios:

- localizar o dono da regra antes de alterar codigo;
- manter regras de negocio sensiveis no backend, banco ou Edge Function responsavel;
- preservar a segregacao entre app interno, portal do cliente e site publico;
- usar TanStack Query para chamadas client-side com cache e invalidacao;
- evitar duplicacao de estado e efeitos sem objetivo claro;
- preservar padroes existentes de React, TypeScript, Tailwind e shadcn/Radix;
- validar mudancas com lint, testes e build quando aplicavel;
- documentar impactos em seguranca, permissoes e integracoes.

## 11. Consideracoes finais

O Grow Finance Hub e uma plataforma operacional em evolucao, com foco em centralizacao, rastreabilidade e seguranca. Sua arquitetura combina frontend React modular com backend Supabase, permitindo que a Grow Contabilidade evolua seus processos digitais sem perder controle sobre dados, permissoes e fluxos criticos.

O memorial descreve o estado funcional e tecnico observado no repositorio local em 29/06/2026 e deve ser atualizado sempre que houver mudancas relevantes de arquitetura, modulos, integracoes ou regras de negocio.
