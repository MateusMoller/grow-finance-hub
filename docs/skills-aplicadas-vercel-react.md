# Skills aplicadas - Vercel React e React Native

## Objetivo
Este documento registra como as duas skills solicitadas foram incorporadas ao Grow Finance Hub para orientar futuras alteracoes de codigo e revisoes tecnicas.

## Fontes
- React Best Practices: https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices
- React Native Skills: https://github.com/vercel-labs/agent-skills/tree/main/skills/react-native-skills

## Aplicacao no projeto atual
O Grow Finance Hub e hoje um projeto web com Vite, React 18, TypeScript, Tailwind, shadcn/Radix, React Router, TanStack Query e Supabase. Por isso:

- A skill de React fica ativa para desenvolvimento, refatoracao, revisao e performance de qualquer arquivo em `src/`.
- A skill de React Native fica registrada como regra condicional para uma futura camada mobile/Expo, mas nao deve alterar decisoes do web app atual.

## Checklist React para novas alteracoes
- Requisicoes independentes devem rodar em paralelo.
- Dados remotos em tela devem usar cache/deduplicacao quando fizer sentido, preferencialmente com TanStack Query.
- Estado duplicado deve ser evitado; valores derivados devem ser calculados a partir da fonte real.
- Componentes nao devem ser declarados dentro de outros componentes.
- `useMemo` e `useCallback` nao devem ser usados automaticamente; exigir custo real, estabilidade de referencia ou medicao.
- Filtros, buscas e tabelas grandes devem considerar indices, `Set`, `Map`, paginacao, virtualizacao ou adiamento de render.
- Bibliotecas pesadas e partes pouco usadas devem ser carregadas sob demanda.
- Efeitos devem ter responsabilidade unica e dependencias estreitas.
- Interacoes nao urgentes podem usar `startTransition`/`useTransition`; render derivado caro pode usar `useDeferredValue`.
- Fluxos densos devem preservar estados de loading, erro, vazio, sucesso, bloqueio e foco acessivel.

## Checklist React Native se houver app mobile
- Definir antes se a entrega sera PWA responsivo, Expo/React Native ou monorepo.
- Usar virtualizacao para listas com volume relevante.
- Evitar objetos e callbacks inline em itens de lista.
- Usar `Text` para strings, `Pressable` para toque e safe areas corretamente.
- Animar `transform` e `opacity`, nao layout.
- Otimizar imagens e manter componentes de item leves.
- Separar regras de negocio compartilhadas da UI web/nativa.

## Onde as instrucoes ficam ativas
As regras operacionais foram adicionadas ao `AGENTS.md` da raiz do repositorio. Este arquivo deve ser lido antes de novas tarefas no projeto.
