# Grow Finance Hub - Agent Instructions

## Perfil de atuacao
- Atue como desenvolvedor full stack senior e gerente tecnico do projeto.
- Entregue solucoes completas, estruturadas e seguras, sem remendos ou atalhos frageis.
- Para qualquer tarefa de front-end, avalie tambem UX/UI: clareza do fluxo, hierarquia visual, acessibilidade, responsividade e facilidade de uso pelo cliente.
- Preserve regras de negocio, permissoes, integracoes Supabase/Acessorias e segregacao entre app interno, portal do cliente e site publico.
- Antes de alterar codigo, entenda o fluxo dono da regra. Mudancas de sincronizacao, deduplicacao e automacao devem ficar preferencialmente no backend/funcao responsavel, nao apenas na tela.

## Stack atual do projeto
- Web app com Vite, React 18, TypeScript, Tailwind, shadcn/Radix, React Router, TanStack Query e Supabase.
- O projeto atual nao e React Native. Regras React Native abaixo so se aplicam se for criada uma camada mobile/Expo ou pacote nativo separado.
- Comandos principais: `npm run lint`, `npm run test`, `npm run build`, `npm run verify:deploy`.

## Skill aplicada: Vercel React Best Practices
Fonte: https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices

Use esta skill em todo trabalho de React/TypeScript dentro de `src/`.

Prioridades obrigatorias:
- Elimine waterfalls: inicie operacoes independentes cedo e use `Promise.all` quando nao houver dependencia entre requisicoes.
- Evite carregar custo desnecessario: use imports diretos, lazy/dynamic imports para componentes pesados e carregamento condicional para bibliotecas nao criticas.
- Mantenha render barato: derive estado no render quando possivel, evite estado duplicado, use inicializacao lazy de `useState` para calculos caros e prefira `useRef` para valores transientes que nao precisam renderizar.
- Nao defina componentes dentro de componentes. Extraia componentes estaveis quando a tela ficar densa ou quando houver risco de recriacao em cada render.
- Use `useMemo` apenas quando houver custo real ou identidade referencial relevante. Nao envolver expressoes primitivas simples em `useMemo`.
- Use `startTransition`/`useTransition` para atualizacoes nao urgentes e `useDeferredValue` para renderizacoes derivadas caras, quando isso melhorar interacao percebida.
- Para listas e buscas repetidas, prefira `Map`/`Set` ou indices precomputados em vez de varreduras repetidas.
- Evite layout thrashing: separe leituras e escritas de layout, e prefira animar `transform` e `opacity`.
- Em telas longas ou densas, considerar virtualizacao, paginacao, `content-visibility` ou divisao em secoes carregadas sob demanda.
- Todo efeito deve ter dependencia estreita e objetivo claro. Logica de interacao deve ficar em handlers, nao em `useEffect`.

Adaptacao ao Grow Finance Hub:
- TanStack Query ja esta no projeto; prefira-o para cache, deduplicacao e estados de loading/erro em chamadas client-side.
- Preserve padroes existentes de componentes Radix/shadcn antes de introduzir dependencias novas.
- Ao otimizar bundle, confira impacto em rotas publicas, app interno e portal do cliente separadamente.
- Em paginas de alto volume como Clientes, Obrigacoes, Calendario, Kanban e E-continuo, trate performance de filtros, listas, tabelas e derived state como requisito de produto.

## Skill aplicada: Vercel React Native Skills
Fonte: https://github.com/vercel-labs/agent-skills/tree/main/skills/react-native-skills

Use esta skill somente se o projeto ganhar app mobile React Native/Expo, pacote compartilhado para mobile ou tela nativa.

Regras condicionais para camada mobile:
- Strings visuais devem estar dentro de componentes `Text`.
- Nao use `&&` com valores possivelmente falsy para renderizacao de conteudo textual; prefira condicoes explicitas.
- Use virtualizacao para listas relevantes e mantenha itens leves, com props primitivas e referencias estaveis.
- Evite objetos inline em `renderItem`; extraia estilos, callbacks e componentes de item.
- Nunca acompanhe posicao de scroll com `useState`; use APIs animadas/refs apropriadas.
- Para animacoes, prefira `transform` e `opacity`; evite animar propriedades de layout.
- Use navegadores nativos, `Pressable`, safe areas corretas e imagens otimizadas (`expo-image` quando em Expo).
- Em monorepo/mobile, mantenha uma unica versao de dependencias compartilhadas e instale dependencias nativas no app correto.

Adaptacao ao Grow Finance Hub:
- Nao aplicar regras nativas em componentes web atuais.
- Se houver expansao mobile, comece com decisao arquitetural explicita: web responsivo, PWA, Expo/React Native ou monorepo compartilhado.
- Componentes e regras de negocio compartilhados devem ficar separados de UI web/nativa para evitar acoplamento.

## Padrao de entrega
- Para tarefas de codigo: implementar, validar com comandos disponiveis e reportar arquivos alterados e testes executados.
- Para tarefas visuais: entregar algo avaliavel visualmente sempre que possivel, preservando funcionalidades.
- Para novo projeto ou nova stack: apresentar opcoes de linguagem/framework com pontos fortes/fracos e perguntar a preferencia antes de iniciar.

<!-- SPECKIT START -->
Current Spec Kit feature plan:
`specs/004-user-permissions/plan.md`
<!-- SPECKIT END -->
