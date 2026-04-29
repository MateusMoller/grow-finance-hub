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
- Classificacao inicial de intencao para pedidos de pendencias, guias, relatorios, chamados e triagem geral.
- Helper frontend para o portal consumir a assistente por `supabase.functions.invoke("grow-assistant")`.
- Endpoint de confirmacao de acoes pendentes em `grow-assistant-confirm-action`.
- Widget inicial do portal em `src/components/portal/GrowAssistantWidget.tsx`.
- Estrutura inicial de webhook WhatsApp em `supabase/functions/whatsapp-webhook`.
- Funcoes auxiliares para `parseWhatsAppMessage`, `findClientByPhone`, `sendWhatsAppTextMessage`, `sendWhatsAppDocumentMessage` e `handleWhatsAppInboundMessage`.
- Resolucao adicional por CNPJ/razao social em cenarios de WhatsApp com mais de um cliente vinculado ao mesmo telefone.
- Migration inicial para `ai_interactions`, `ai_action_logs`, `ai_duplicate_checks` e `whatsapp_webhook_logs`.
- Atualização do `.env.example` com variáveis novas de IA e WhatsApp.

### Ainda nao implementado nesta fase

- envio real de relatorios/PDFs pelo WhatsApp com link seguro e aprovacao humana.
- geracao automatica de PDFs e links assinados para entrega de relatorios.
- memoria persistente de selecao de cliente no WhatsApp entre mensagens ambiguas.

## Plano das proximas fases

1. Aplicar as migrations novas no projeto Supabase.
2. Refinar o widget do portal com historico persistente e streaming, se fizer sentido.
3. Refinar validacao de identidade no WhatsApp para cenarios sensiveis e multiplos clientes.
4. Adicionar envio por link seguro para relatorios/documentos sensiveis.
5. Integrar geracao real de relatorios/PDFs conforme os modulos internos forem amadurecendo.

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
6. Se a resposta vier com `confirmation_required`, o frontend pode chamar `grow-assistant-confirm-action` com `actionId` e `confirm`.

## Fluxo WhatsApp

1. `GET /functions/v1/whatsapp-webhook` responde ao desafio de verificacao do Meta webhook.
2. `POST /functions/v1/whatsapp-webhook` recebe mensagens/eventos.
3. O backend normaliza o telefone e tenta localizar o cliente por `clients.phone` e `client_data`.
4. Se houver ambiguidade ou falta de vinculo seguro, a resposta pede identificacao adicional ou direciona para humano.
5. Se houver cliente unico com base suficiente, ou se a resposta do usuario resolver a ambiguidade por CNPJ/razao social, o backend chama `runGrowAssistant(..., channel = "whatsapp")`.
6. Se o pedido envolver relatorio em WhatsApp sem sessao validada, o backend prefere link seguro/revisao humana.
7. Se as credenciais de envio estiverem configuradas, a resposta e enviada pela Cloud API; caso contrario, o webhook processa e registra log sem disparar mensagem.

## Lista de tools

- `consultar_pendencias_cliente`
- `consultar_status_chamados`
- `criar_chamado`
- `detectar_duplicidade`
- `consultar_status_guias`
- `gerar_resumo_cliente`
- `solicitar_envio_relatorio`

## Niveis de risco

- `baixo`: consultas operacionais, consulta de chamados, abertura normal de chamado.
- `medio`: segunda via de guia, relatorio resumido e acoes que exigem confirmacao explicita.
- `alto`: relatorios sensiveis, dados trabalhistas/fiscais sensiveis e qualquer envio que exija revisao humana.

## Regras de seguranca

- `OPENAI_API_KEY` nunca vai para o frontend.
- O backend sempre revalida o `cliente_id` antes de montar contexto ou executar tools.
- O contexto enviado ao modelo contem apenas dados minimos do cliente autorizado.
- Acoes sensiveis nao sao executadas automaticamente.
- WhatsApp sem identidade validada em sessao nao recebe relatorio sensivel diretamente.
- Toda acao relevante gera trilha em `ai_interactions`, `ai_action_logs`, `ai_duplicate_checks` ou `whatsapp_webhook_logs`.

## Como testar

### Portal

1. Usuario portal autenticado pergunta "quais documentos estao pendentes?" e recebe resposta sem dados de outro cliente.
2. Usuario portal tenta usar um `clienteId` diferente do vinculado e a function deve falhar com erro de autorizacao.
3. Usuario pergunta "minhas guias estao prontas?" e a assistente deve consultar `consultar_status_guias`.
4. Usuario pede "me envie o relatorio financeiro de marco" e a assistente deve retornar `confirmation_required`.
5. Usuario confirma a acao no widget e `grow-assistant-confirm-action` deve registrar a solicitacao em `client_requests`.
6. Usuario cria um chamado parecido com outro aberto e a assistente deve sinalizar duplicidade ou pedir confirmacao.
7. Usuario cria um chamado novo e a assistente deve retornar `created_ticket`.

### WhatsApp

8. Telefone conhecido e com um unico cliente vinculado envia mensagem; o webhook deve localizar o cliente e responder.
9. Telefone desconhecido deve receber mensagem pedindo identificacao segura, sem expor dados.
10. Telefone com mais de um cliente vinculado deve pedir CNPJ/razao social.
11. Se o usuario responder com o CNPJ e a ambiguidade puder ser resolvida, a assistente deve prosseguir com aquele cliente apenas.
12. Pedido de relatorio sensivel por WhatsApp sem sessao validada deve cair em `human_review_required` ou link seguro.

### Configuracao

13. Remova `OPENAI_API_KEY` do secret local da function e valide que a resposta seja um erro controlado de configuracao.
14. Revise os logs gerados para confirmar que o `cliente_id` das tabelas de auditoria sempre corresponde ao cliente autorizado da conversa.
