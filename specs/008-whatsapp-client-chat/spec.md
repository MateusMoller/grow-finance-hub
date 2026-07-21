# Feature Specification: WhatsApp Client Chat

**Feature Branch**: `008-whatsapp-client-chat`

**Created**: 2026-07-16

**Status**: Draft

**Input**: User description: "Novo canal de atendimento via WhatsApp: módulo de chat com o cliente em que, de um lado, o cliente usa o WhatsApp normalmente e, dentro do sistema, a equipe usa a integração do WhatsApp para se comunicar com ele. A interface deve ser clean, dinâmica, com ótima experiência de uso e fortemente inspirada na página de conversa do WhatsApp Web."

## Clarifications

### Session 2026-07-16

- Q: Como o v1 deve tratar conversas fora da janela de atendimento ativa do WhatsApp? → A: V1 permite responder apenas conversas dentro da janela de atendimento ativa; fora dela, bloqueia envio livre e mostra aviso.
- Q: Quando uma conversa nova pode ser vinculada automaticamente a um cliente? → A: Vincular automaticamente somente quando houver exatamente um cliente ativo com telefone correspondente; se houver conflito ou baixa confiança, deixar como não identificado.
- Q: Quem deve receber notificação quando uma nova mensagem de cliente chegar? → A: Se houver responsável, notifica só ele; se não houver responsável, notifica a fila/equipe elegível do módulo.
- Q: Quais anexos o v1 deve aceitar no atendimento via WhatsApp? → A: V1 aceita imagens, PDFs e documentos comuns, até 25 MB por arquivo; áudio/vídeo ficam fora.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Atender cliente pelo WhatsApp dentro do sistema (Priority: P1)

Como colaborador interno, quero visualizar conversas de clientes em uma interface de chat familiar, responder mensagens e acompanhar o histórico em tempo real, para centralizar o atendimento sem precisar alternar entre ferramentas externas.

**Why this priority**: Este é o fluxo principal do módulo. Sem receber, visualizar e responder conversas, o canal não entrega valor operacional.

**Independent Test**: Pode ser testado selecionando uma conversa ativa, lendo o histórico, enviando uma resposta e confirmando que a conversa exibe a nova mensagem com estado claro de envio.

**Acceptance Scenarios**:

1. **Given** uma conversa de cliente com mensagens existentes, **When** o usuário abre o módulo de WhatsApp, **Then** a conversa aparece com histórico ordenado, identificação do cliente e campo de resposta disponível.
2. **Given** uma conversa aberta, **When** o usuário envia uma mensagem, **Then** a mensagem aparece no painel da conversa com indicador de status e a conversa sobe para o topo da lista.
3. **Given** uma nova mensagem recebida de cliente, **When** o usuário está no módulo, **Then** a lista de conversas e a conversa aberta são atualizadas sem exigir recarregamento manual.

---

### User Story 2 - Gerenciar fila de conversas e priorizar atendimento (Priority: P2)

Como usuário interno, quero uma lista de conversas organizada por mensagens recentes, não lidas, cliente, responsável e status de atendimento, para priorizar rapidamente quem precisa de resposta.

**Why this priority**: A operação precisa identificar pendências e conversas urgentes sem depender de memória ou busca manual.

**Independent Test**: Pode ser testado recebendo mensagens em múltiplas conversas e verificando ordenação, marcadores visuais, filtros e contadores.

**Acceptance Scenarios**:

1. **Given** múltiplas conversas com horários diferentes, **When** o usuário abre a lista, **Then** a conversa com a mensagem mais recente aparece primeiro.
2. **Given** uma conversa com mensagem não lida, **When** a lista é exibida, **Then** a conversa mostra marcador visual e contador de não lidas.
3. **Given** filtros por status, responsável ou cliente, **When** o usuário aplica um filtro, **Then** apenas conversas correspondentes aparecem sem perder o contexto do atendimento.

---

### User Story 3 - Compartilhar anexos e registrar contexto do atendimento (Priority: P3)

Como colaborador interno, quero enviar e receber anexos, visualizar prévias quando possível e manter o contexto da conversa vinculado ao cliente, para tratar solicitações sem fragmentar documentos e informações.

**Why this priority**: Atendimento contábil, fiscal e operacional costuma depender de documentos, imagens, comprovantes e registros enviados pelo cliente.

**Independent Test**: Pode ser testado enviando e recebendo anexos permitidos em uma conversa e confirmando que eles ficam acessíveis no histórico.

**Acceptance Scenarios**:

1. **Given** uma conversa aberta, **When** o cliente envia um arquivo permitido, **Then** o arquivo aparece na conversa com nome, tipo e ação de visualização ou download.
2. **Given** uma conversa aberta, **When** o usuário interno anexa um arquivo permitido, **Then** o arquivo aparece na conversa com estado de envio e permanece no histórico.
3. **Given** uma conversa associada a um cliente cadastrado, **When** o usuário visualiza o cabeçalho ou painel lateral, **Then** o sistema exibe dados mínimos do cliente para contextualizar o atendimento.

---

### User Story 4 - Controlar responsabilidade e conclusão de atendimentos (Priority: P4)

Como gestor ou usuário autorizado, quero atribuir conversas, alterar status e acompanhar pendências, para organizar a rotina de atendimento e evitar mensagens sem dono.

**Why this priority**: A operação ganha previsibilidade quando cada conversa tem dono, status e histórico de atendimento.

**Independent Test**: Pode ser testado atribuindo uma conversa a um usuário, alterando status e verificando se a lista reflete a alteração.

**Acceptance Scenarios**:

1. **Given** uma conversa sem responsável, **When** um usuário autorizado atribui um responsável, **Then** a conversa passa a exibir o responsável definido.
2. **Given** uma conversa em atendimento, **When** o usuário marca como resolvida, **Then** a conversa sai da fila principal de pendências e mantém histórico acessível.
3. **Given** uma conversa atribuída a outro responsável, **When** um usuário sem permissão tenta alterar a atribuição, **Then** o sistema bloqueia a ação e informa o motivo.

### Edge Cases

- Mensagem recebida de número sem correspondência única e confiável com cliente ativo deve criar ou exibir uma conversa não identificada com opção de vinculação manual a cliente ativo.
- Quando houver exatamente um cliente ativo na organização com telefone correspondente ao contato WhatsApp, a conversa deve ser vinculada automaticamente a esse cliente.
- Conversas com volume alto de mensagens devem carregar o histórico recente primeiro e permitir consultar mensagens anteriores sem travar a tela.
- Falhas temporárias de envio devem deixar a mensagem com estado de erro e permitir nova tentativa sem duplicar a mensagem.
- Tentativas de envio fora da janela de atendimento ativa devem ser bloqueadas com aviso claro, sem criar mensagem enviada ao cliente.
- Arquivos fora dos tipos permitidos, acima de 25 MB ou suspeitos devem ser recusados com mensagem clara ao usuário.
- Se dois usuários internos responderem a mesma conversa ao mesmo tempo, ambos devem ver as novas mensagens e o responsável/status atualizado.
- Se o contato do cliente estiver inativo ou sem autorização de atendimento, o sistema deve impedir novos envios e preservar histórico.
- Mensagens recebidas fora do expediente devem permanecer registradas e destacadas como pendentes até atendimento.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a dedicated internal module for WhatsApp-based client conversations.
- **FR-002**: System MUST display a conversation list inspired by WhatsApp Web, with recent conversations first, visual unread indicators, client/contact name, latest message preview and timestamp.
- **FR-003**: Users MUST be able to open a conversation and view messages in chronological order with clear distinction between client messages and internal outbound messages.
- **FR-004**: Users MUST be able to send text messages to the selected client contact from the internal conversation view.
- **FR-004a**: System MUST allow free-form outbound replies only while the WhatsApp atendimento window is active; outside that window, the system MUST block free-form sending and show a clear user-facing reason.
- **FR-005**: System MUST show message delivery state using user-friendly states such as sending, sent, failed, received or read when available.
- **FR-006**: System MUST prevent duplicate outbound messages caused by repeated clicks, repeated key presses, retries or connectivity instability.
- **FR-007**: System MUST receive inbound client messages and update conversation list, unread counts and open conversation without manual refresh when the user is active in the module.
- **FR-008**: Users MUST be able to search conversations by client name, contact name, phone number and recent message content.
- **FR-009**: Users MUST be able to filter conversations by unread status, assigned user, conversation status, linked client and date range.
- **FR-010**: System MUST support attachment receipt and sending for images, PDFs and common document formats up to 25 MB per file, showing file name, type, size and access action in the message timeline; audio and video attachments are out of scope for v1.
- **FR-011**: System MUST link each identified conversation to one active client when exactly one active client in the same organization has a matching phone number, and allow authorized users to manually link unmatched or conflicting conversations to active clients.
- **FR-012**: System MUST provide a clean conversation header with client/contact identity, phone number, linked client status and quick access to client context.
- **FR-013**: System MUST allow authorized users to assign or reassign a conversation to an internal responsible user or team.
- **FR-014**: System MUST allow authorized users to change conversation status, including at least open, in attendance, pending client, resolved and archived.
- **FR-015**: System MUST preserve complete conversation history for audit and operational continuity.
- **FR-016**: System MUST visually separate client-facing messages from internal-only metadata, and MUST NOT expose internal notes or internal status changes to the client.
- **FR-017**: System MUST notify relevant internal users when a new client message arrives, when a conversation is assigned to them, and when an outbound message fails.
- **FR-017a**: For new inbound client messages, if the conversation has an assigned responsible user, the system MUST notify that user; if the conversation has no responsible user, the system MUST notify the eligible WhatsApp atendimento queue/team.
- **FR-018**: System MUST allow users to mark conversations as read when they open or intentionally clear them.
- **FR-019**: System MUST provide a responsive layout that remains usable on common desktop and tablet widths, prioritizing a WhatsApp Web-like two-pane experience on desktop.
- **FR-020**: System MUST provide empty, loading and error states that guide users without exposing technical details.
- **FR-021**: System MUST log important operational events, including inbound message received, outbound message sent, delivery failure, assignment changed, status changed and client link changed.

### Security, Access & Tenant Requirements *(mandatory when data/auth is affected)*

- **SEC-001**: Affected surfaces are internal app, client data, external WhatsApp integration, backend integration handlers, file storage, notifications and audit logs.
- **SEC-002**: Only internal users with explicit access to the WhatsApp atendimento module may view conversations. Client portal users and unauthenticated users MUST NOT access the internal module.
- **SEC-003**: Sending messages, attaching files, assigning conversations and changing status MUST be restricted to authorized internal roles or module-granted collaborators.
- **SEC-004**: Organization boundaries MUST be enforced for every conversation, message, attachment, notification, audit entry and client linkage.
- **SEC-005**: Client boundaries MUST be enforced so users only see client-linked context allowed by their organization access.
- **SEC-006**: Sensitive integration credentials and privileged operations MUST be handled only outside the browser-facing interface.
- **SEC-007**: Uploaded and received files MUST be scoped to the organization and conversation, and access MUST require authenticated authorization.
- **SEC-007a**: Uploaded and received files MUST be rejected when they are outside the v1 allowed types, exceed 25 MB, or fail safety validation.
- **SEC-008**: The system MUST avoid displaying full sensitive document content in conversation previews; previews should use safe metadata and short text excerpts.
- **SEC-009**: The system MUST record audit events for message send/receive, failures, status changes, assignment changes and client linkage changes.
- **SEC-010**: The system MUST preserve a clear separation between messages sent to the client and internal-only operational notes or events.

### Scalability & Performance Requirements *(mandatory for high-volume flows)*

- **PERF-001**: The conversation list MUST support at least 10,000 conversations per organization through bounded loading, search and filters.
- **PERF-002**: The message timeline MUST support long histories by loading recent messages first and retrieving older messages on demand.
- **PERF-003**: Opening a typical conversation with up to 100 recent messages SHOULD become usable in under 2 seconds for 95% of attempts under normal network conditions.
- **PERF-004**: Sending a text message SHOULD provide visible local feedback in under 500 milliseconds.
- **PERF-005**: Filters and search results SHOULD update in under 1 second for typical operational usage.
- **PERF-006**: Attachments SHOULD be processed without blocking text conversation usage.
- **PERF-007**: New inbound messages SHOULD appear in the active user interface in under 3 seconds for 95% of active sessions after they are accepted by the system.

### Key Entities *(include if feature involves data)*

- **WhatsApp Conversation**: A client-facing conversation associated with an organization, phone/contact, optional linked client, status, responsible user/team, unread state and latest message summary.
- **WhatsApp Message**: A single inbound or outbound message with sender direction, content type, text or attachment metadata, timestamp, delivery state and audit identity.
- **WhatsApp Contact**: A phone-based identity representing the client-side participant, with name, phone number, match confidence and optional linked client.
- **Conversation Assignment**: Operational ownership record defining responsible user or team and assignment history.
- **Conversation Attachment**: File metadata associated with a message, including safe display name, type, size, storage/access state and relationship to organization/conversation.
- **Conversation Event**: Internal audit event for received messages, sent messages, status changes, assignment changes, linkage changes and failures.
- **Conversation Notification**: Internal alert generated for new messages, assignment changes or failed sends.

### Data Classification *(include if feature involves data)*

- **Public**: N/A. No WhatsApp conversation data is public.
- **Internal**: Conversation queue, assignments, operational statuses, delivery states, audit events and internal notifications.
- **Client Portal**: N/A for v1. Clients continue using WhatsApp normally and do not access this module from the portal.
- **Sensitive/Regulated**: Client identity, phone numbers, message content, received documents, sent documents, fiscal/accounting/labor context, attachment metadata and WhatsApp integration credentials.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 90% of internal users can find and open a client conversation in under 10 seconds during usability testing.
- **SC-002**: 95% of text messages show immediate sending feedback in under 500 milliseconds.
- **SC-003**: 95% of active inbound messages appear in the conversation list and open conversation in under 3 seconds after system acceptance.
- **SC-004**: Users can complete the primary workflow of reading a client message and sending a response in under 30 seconds.
- **SC-005**: The module supports at least 10,000 conversations per organization without requiring users to manually refresh or wait more than 2 seconds for common list interactions.
- **SC-006**: At least 90% of pilot users rate the interface as clear and familiar when compared with common messaging tools.
- **SC-007**: Duplicate outbound messages caused by repeated clicks or repeated Enter presses are reduced to zero in acceptance testing.
- **SC-008**: Support coordination improves measurably by allowing users to identify unread and assigned conversations with no more than one click from the module landing view.

## Assumptions

- The client will continue using the standard WhatsApp app and will not need a new portal login for this channel.
- The internal module will be available only to authenticated internal users with explicit module access.
- The first version focuses on one-to-one conversations between the organization and a client contact, not WhatsApp groups.
- Audio and video attachments are outside v1.
- Conversation design should be strongly inspired by WhatsApp Web: conversation list on the left, active conversation on the right, compact message bubbles, timestamps, search and visible unread indicators.
- Internal-only notes are outside the client-facing message stream for this specification unless added in a later clarification or feature.
- Message templates, campaigns, mass broadcasts and marketing automation are outside the first version unless explicitly added later.
- Free-form replies outside the active WhatsApp atendimento window are outside v1; template-based reopening may be specified in a later feature.
- Voice/video calls are outside the first version.
- Existing client records, user permissions, notification patterns and audit expectations should be reused conceptually.
- The feature depends on a valid WhatsApp business integration being available before production use.
