# AI Integration

## Objetivo

Criar uma base segura para a assistente operacional da Grow usando OpenAI no backend, Supabase como camada de auth/dados e isolamento estrito por cliente.

## Analise atual do repositorio

### Stack principal

- Frontend: Vite + React 18 + TypeScript + Tailwind + shadcn/Radix.
- Roteamento: `react-router-dom` em [src/App.tsx](/C:/Users/SISTEMAS/Nextcloud/ADMINISTRATIVO/Documentos%20Grow/Departamento%20Pessoal/Mateus/Ferramentas/Site-grow-2.0/grow-finance-hub/src/App.tsx).
- Estado assíncrono: TanStack Query.
- Auth e dados: Supabase JS no frontend, com Edge Functions para integrações sensíveis.
- Backend atual: Supabase Edge Functions em `supabase/functions/*`.

### Arquivos e pastas relevantes

- [src/App.tsx](/C:/Users/SISTEMAS/Nextcloud/ADMINISTRATIVO/Documentos%20Grow/Departamento%20Pessoal/Mateus/Ferramentas/Site-grow-2.0/grow-finance-hub/src/App.tsx): rotas públicas, internas e portal.
- [src/hooks/useAuth.tsx](/C:/Users/SISTEMAS/Nextcloud/ADMINISTRATIVO/Documentos%20Grow/Departamento%20Pessoal/Mateus/Ferramentas/Site-grow-2.0/grow-finance-hub/src/hooks/useAuth.tsx): sessão Supabase e resolução de papéis em `user_roles`.
- [src/components/app/ProtectedRoute.tsx](/C:/Users/SISTEMAS/Nextcloud/ADMINISTRATIVO/Documentos%20Grow/Departamento%20Pessoal/Mateus/Ferramentas/Site-grow-2.0/grow-finance-hub/src/components/app/ProtectedRoute.tsx): separação entre escopo interno e portal.
- [src/integrations/supabase/client.ts](/C:/Users/SISTEMAS/Nextcloud/ADMINISTRATIVO/Documentos%20Grow/Departamento%20Pessoal/Mateus/Ferramentas/Site-grow-2.0/grow-finance-hub/src/integrations/supabase/client.ts): cliente público do Supabase; aqui nao cabe segredo de OpenAI.
- [src/integrations/supabase/types.ts](/C:/Users/SISTEMAS/Nextcloud/ADMINISTRATIVO/Documentos%20Grow/Departamento%20Pessoal/Mateus/Ferramentas/Site-grow-2.0/grow-finance-hub/src/integrations/supabase/types.ts): tipos gerados do banco.
- [src/pages/PortalClientePage.tsx](/C:/Users/SISTEMAS/Nextcloud/ADMINISTRATIVO/Documentos%20Grow/Departamento%20Pessoal/Mateus/Ferramentas/Site-grow-2.0/grow-finance-hub/src/pages/PortalClientePage.tsx): fluxo atual do portal do cliente e superfícies de solicitações/documentos/tarefas.
- [supabase/functions/acessorias-module/index.ts](/C:/Users/SISTEMAS/Nextcloud/ADMINISTRATIVO/Documentos%20Grow/Departamento%20Pessoal/Mateus/Ferramentas/Site-grow-2.0/grow-finance-hub/supabase/functions/acessorias-module/index.ts): melhor referência de integração segura backend-first.
- [supabase/functions/ensure-client-portal-profile/index.ts](/C:/Users/SISTEMAS/Nextcloud/ADMINISTRATIVO/Documentos%20Grow/Departamento%20Pessoal/Mateus/Ferramentas/Site-grow-2.0/grow-finance-hub/supabase/functions/ensure-client-portal-profile/index.ts): padrão atual para validar sessão pelo token do usuário e usar service role apenas no backend.
- [supabase/config.toml](/C:/Users/SISTEMAS/Nextcloud/ADMINISTRATIVO/Documentos%20Grow/Departamento%20Pessoal/Mateus/Ferramentas/Site-grow-2.0/grow-finance-hub/supabase/config.toml): registro das Edge Functions e `verify_jwt`.

### Padrões encontrados

- O frontend chama o backend sensível por `supabase.functions.invoke(...)`.
- As Edge Functions validam o usuário pelo JWT do Supabase antes de usar `SUPABASE_SERVICE_ROLE_KEY`.
- O portal atual usa `clients.portal_user_id` como vínculo principal, o que hoje sugere uma relação 1 usuário portal -> 1 cliente por padrão.
- Isso é suficiente para a Fase 1, mas a Fase 2 deve tratar explicitamente o modelo futuro de multiempresa por usuário portal caso seja um requisito operacional real.

## Decisao arquitetural da Fase 1

Para a base da IA, a melhor aderência ao projeto atual é:

1. Manter OpenAI apenas em backend confiável.
2. Reutilizar Supabase Edge Functions como superfície de execução.
3. Ler `OPENAI_API_KEY` via `Deno.env`.
4. Usar Responses API diretamente no backend.
5. Preparar helpers compartilhados em `supabase/functions/_shared`.

Essa decisão evita:

- expor segredo no bundle Vite;
- criar uma API paralela fora do padrão atual do projeto;
- duplicar autenticação e validação de sessão;
- misturar chamadas sensíveis com o cliente público do Supabase.

## Entrega desta fase

### Implementado

- Helper backend-only da OpenAI em `supabase/functions/_shared/ai/openaiClient.ts`.
- Leitura segura de `OPENAI_API_KEY` e `AI_DEFAULT_MODEL`.
- Bloqueio explícito de uso em client-side.
- Tratamento controlado para ausência de configuração.
- Base pronta para chamadas à Responses API.
- Camada compartilhada para auth da Edge Function, contexto autorizado por cliente, tools internas e classificacao de risco.
- `runGrowAssistant(...)` com loop de function/tool calling via Responses API.
- Edge Function inicial `grow-assistant` com JWT obrigatorio.
- Classificacao de risco para acoes de baixo, medio e alto impacto.
- Registro de acoes pendentes de confirmacao e pendentes de revisao humana em `ai_action_logs`.
- Deteccao de duplicidade com camada objetiva e segunda camada semantica via OpenAI, com fallback seguro.
- Helper frontend para o portal consumir a assistente por `supabase.functions.invoke("grow-assistant")`.
- Estrutura inicial de webhook WhatsApp em `supabase/functions/whatsapp-webhook`.
- Funcoes auxiliares para `parseWhatsAppMessage`, `findClientByPhone`, `sendWhatsAppTextMessage`, `sendWhatsAppDocumentMessage` e `handleWhatsAppInboundMessage`.
- Migration inicial para `ai_interactions`, `ai_action_logs`, `ai_duplicate_checks` e `whatsapp_webhook_logs`.
- Atualização do `.env.example` com variáveis novas de IA e WhatsApp.

### Ainda nao implementado nesta fase

- endpoint dedicado de confirmacao `POST /api/ai/actions/confirm`.
- interface visual do widget da assistente no portal.
- envio real de relatorios/PDFs pelo WhatsApp com link seguro e aprovacao humana.

## Plano das proximas fases

1. Aplicar as migrations novas no projeto Supabase.
2. Conectar o widget/UX do portal ao helper `src/lib/ai/growAssistant.ts`.
3. Implementar o endpoint de confirmacao para reaproveitar os `actionId` ja persistidos.
4. Refinar validacao de identidade no WhatsApp para cenarios sensiveis e multiplos clientes.
5. Adicionar envio por link seguro para relatorios/documentos sensiveis.

## Variaveis de ambiente

### Frontend publico

- `VITE_SUPABASE_PROJECT_ID`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_WEB_PUSH_PUBLIC_KEY`

### Backend privado

- `OPENAI_API_KEY`
- `AI_DEFAULT_MODEL`
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`

Para producao, as variaveis privadas devem ser configuradas como secrets das Supabase Edge Functions, e nao como variaveis expostas ao Vite.

## Fluxo Portal

1. O frontend autenticado chama `grow-assistant` via `supabase.functions.invoke(...)`.
2. A Edge Function valida o JWT e resolve o contexto autorizado do cliente.
3. A assistente recebe somente o contexto daquele cliente.
4. Tools internas sao executadas apenas no backend e sempre revalidam `cliente_id`.
5. A resposta retorna `reply`, `action` e `safety`, pronta para o portal exibir.

## Fluxo WhatsApp

1. `GET /functions/v1/whatsapp-webhook` responde ao desafio de verificacao do Meta webhook.
2. `POST /functions/v1/whatsapp-webhook` recebe mensagens/eventos.
3. O backend normaliza o telefone e tenta localizar o cliente por `clients.phone` e `client_data`.
4. Se houver ambiguidade ou falta de vinculo seguro, a resposta pede identificacao adicional ou direciona para humano.
5. Se houver cliente unico com base suficiente, o backend chama `runGrowAssistant(..., channel = "whatsapp")`.
6. Se as credenciais de envio estiverem configuradas, a resposta e enviada pela Cloud API; caso contrario, o webhook processa e registra log sem disparar mensagem.
