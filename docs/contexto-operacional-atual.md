# Contexto Operacional Atual - Grow Finance Hub

Este documento resume o estado tecnico que deve ser considerado antes de qualquer alteracao no projeto.

## Projeto

- Aplicacao web Vite + React 18 + TypeScript.
- UI com Tailwind, shadcn/Radix, lucide-react e componentes locais.
- Roteamento com React Router.
- Estado remoto/cache: TanStack Query deve ser preferido em modulos novos ou de alto volume.
- Backend principal: Supabase Auth, Database, Storage, Realtime e Edge Functions.

## Camadas do produto

1. Site publico
- Rotas institucionais livres: `/`, `/sobre`, `/inicio`, `/solucoes`, `/contato`, `/newsletter`, `/privacidade`, `/termos`.
- Nao deve receber dependencias ou fluxos internos desnecessarios.

2. App interno
- Rotas em `/app/*`.
- Protecao por `ProtectedRoute` com escopo `internal`.
- Layout principal em `AppLayout` e navegacao em `AppSidebar`.
- Modulos principais: dashboard, tarefas, calendario, clientes, CRM, chat interno, relatorios, financeiro, obrigacoes, notificacoes, usuarios, sugestoes, manual e configuracoes.

3. Portal do cliente
- Rota principal: `/app/portal`.
- Protecao por `ProtectedRoute` com escopo `portal`.
- Deve preservar isolamento por cliente e nao expor dados internos.

## Controle de acesso

- Auth fica em `src/hooks/useAuth.tsx`.
- Regras de papeis ficam em `src/lib/accessControl.ts`.
- Papeis internos: `admin`, `director`, `manager`, `employee`, `commercial`, `partner`, `departamento_pessoal`, `fiscal`, `contabil`.
- Papel de cliente: `client`.
- Qualquer mudanca de permissao deve preservar a segregacao entre app interno e portal.

## Supabase

- Projeto remoto: `vgkmcerjlwnzbiukinhd`.
- As migrations locais estao alinhadas com o remoto ate `20260513122543_add_grow_document_robot_pipeline`.
- O banco remoto possui as tabelas recentes de obrigacoes, IA, manual, open finance e robo de documentos.
- O arquivo `src/integrations/supabase/types.ts` foi restaurado como mapa generico funcional das tabelas reais do banco remoto.
- Para tipagem detalhada coluna a coluna, regenerar futuramente com Supabase CLI autenticado:

```bash
npx supabase gen types typescript --project-id vgkmcerjlwnzbiukinhd --schema public > src/integrations/supabase/types.ts
```

## Modulos ativos e legados

- O fluxo oficial atual de obrigacoes e o modulo nativo Grow, baseado em `GrowObligationsWorkspace` e `grow-obligations-module`.
- Acessorias/e-continuo separado deve ser tratado como legado, salvo pedido explicito.
- Processos/Documentos antigos tambem devem ser tratados como legado.
- Mudancas novas devem priorizar o modulo nativo e evitar reativar fluxos antigos sem decisao explicita.

## Integracoes sensiveis

- Segredos nunca devem ir para o frontend.
- OpenAI, WhatsApp, Acessorias, Open Finance e tokens devem ficar em Edge Functions ou backend confiavel.
- O frontend deve chamar integracoes sensiveis via `supabase.functions.invoke`.
- Edge Functions devem validar JWT/usuario e papel antes de usar service role.

## Regras para alteracoes futuras

- Antes de alterar codigo, localizar o dono da regra: tela, hook, lib, Edge Function ou migration.
- Regras de negocio, sincronizacao, deduplicacao, automacao e conclusao de obrigacoes devem ficar preferencialmente no backend responsavel.
- Em React/TypeScript dentro de `src/`, aplicar boas praticas de performance:
  - evitar waterfalls;
  - usar `Promise.all` em requisicoes independentes;
  - evitar estado duplicado;
  - nao definir componentes dentro de componentes;
  - usar TanStack Query quando houver cache/invalidacao;
  - manter efeitos com dependencias estreitas.
- Em tarefas visuais, avaliar UX/UI, responsividade, acessibilidade e clareza operacional.
- Preservar padroes shadcn/Radix existentes antes de introduzir dependencias novas.

## Ambiente local observado

- A exportacao local nao contem `.git`.
- `node_modules` foi instalado com `npm install`.
- Ambiente atual usa Node `18.20.8`, mas Vite 8/Vitest 4 exigem Node `20.19+`.
- `npm run lint` passou.
- `npm run build` e `npm run test` falham neste ambiente por versao de Node, antes de validar o app.

