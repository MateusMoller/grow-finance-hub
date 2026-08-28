# Research: Revisão das permissões de tarefas

## Decision 1 — Separar leitura por RLS de mutações por capacidade

**Decision**: manter RLS como defesa obrigatória para SELECT e isolamento de tenant, mas conduzir mutações sensíveis por uma operação backend canônica que avalia ação, tarefa e campos.

**Rationale**: RLS decide acesso a linhas, porém não expressa de forma clara uma matriz rica de campos e transições. A operação canônica pode bloquear mudanças de setor, responsável, integração e organização separadamente e auditar na mesma transação.

**Alternatives considered**: manter UPDATE direto protegido apenas por RLS (rejeitado por granularidade insuficiente); implementar tudo no frontend (rejeitado por segurança); criar um serviço externo separado (rejeitado por complexidade desnecessária).

## Decision 2 — Helpers de política fora da superfície pública

**Decision**: mover helpers `SECURITY DEFINER` usados somente por políticas para schema privado/não exposto, com `search_path` vazio e referências qualificadas; revogar execução de PUBLIC/anon e conceder somente quando indispensável.

**Rationale**: funções usadas em políticas não precisam estar expostas pelo Data API. Restringir execução reduz sondagem e abuso de funções privilegiadas.

**Alternatives considered**: manter em `public` com validação de `auth.uid()` (aceitável como transição, mas ainda expõe superfície); converter todos para invoker (pode provocar recursão ou negar consultas auxiliares protegidas).

## Decision 3 — Políticas canônicas únicas e grants mínimos

**Decision**: possuir exatamente uma política canônica por operação/tabela, testada por nome, comando e papel; revogar `TRUNCATE`, `TRIGGER` e `REFERENCES` de papéis da aplicação.

**Rationale**: políticas permissivas múltiplas são combinadas por OR. Uma política antiga mais ampla invalida a intenção de uma nova mais restrita. Operações globais como TRUNCATE não são filtradas por RLS.

**Alternatives considered**: adicionar política RESTRICTIVE sobre as existentes (útil como defesa, mas mantém dívida e ambiguidade); confiar que a API não expõe TRUNCATE (não satisfaz menor privilégio).

## Decision 4 — Auditoria atômica

**Decision**: autorização, lock, mutação e evento de sucesso serão uma única transação; negações de alto risco serão registradas por rota segura separada.

**Rationale**: auditoria best-effort após a mutação pode falhar e produzir estado sem evidência. A atomicidade garante correspondência entre mudança e histórico.

**Alternatives considered**: trigger genérico para toda mudança (não conhece intenção/ação e ator delegado com clareza); manter RPC de auditoria no frontend (continua não atômico).

## Decision 5 — Atores humanos e de sistema distintos

**Decision**: toda mutação recebe `actor_kind` humano ou sistema. Ações humanas exigem JWT e capacidade da tarefa; jobs de sistema exigem origem allowlisted, organização, chave idempotente e vínculo técnico.

**Rationale**: service-role não deve converter acesso ao módulo de origem em acesso irrestrito à tarefa. Jobs genuínos precisam operar sem usuário, mas com identidade e finalidade auditáveis.

**Alternatives considered**: tratar toda automação como admin (rejeitado por privilégio excessivo); impersonar sempre um usuário (inadequado para jobs agendados).

## Decision 6 — Migração gradual do legado

**Decision**: inventário → backfill canônico → shadow comparison → enforcement → remoção do fallback.

**Rationale**: remover fallback imediatamente pode interromper usuários ainda não migrados; mantê-lo indefinidamente impede revogação confiável.

**Alternatives considered**: big bang (alto risco operacional); legado permanente (alto risco de segurança).

## Decision 7 — Testes de matriz no banco e nos contratos

**Decision**: pgTAP verifica políticas, grants, helpers e resultados de RLS; Vitest/Deno verificam matriz de capacidades, UX e Edge Functions.

**Rationale**: testes de UI não provam segurança do banco, e testes SQL não cobrem validação das funções privilegiadas ou apresentação consistente.

**Alternatives considered**: somente E2E (lento e difícil diagnosticar); somente unitário (não prova políticas reais).

## Decision 8 — Consultas filtradas e incrementais

**Decision**: consultas de tarefas aplicam organização/filtros/paginação antes de entregar resultados, com índices para status, setor, responsável, cliente, prazo e integração; cache separado por organização e escopo.

**Rationale**: 10.000 tarefas não devem ser baixadas nem filtradas no render; mudança de organização não pode reutilizar cache anterior.

**Alternatives considered**: filtrar tudo no frontend (custo e risco de exposição); virtualização sem paginação (reduz render, mas não rede nem autorização).

## Primary Sources

- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Database Functions: https://supabase.com/docs/guides/database/functions
- Supabase pgTAP: https://supabase.com/docs/guides/database/extensions/pgtap
- PostgreSQL Row Security Policies: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
