# Contract: WhatsApp Message Flow

This contract describes the user-visible conversation behavior for the improved WhatsApp flow.

## Main Entry

**Trigger**: Inbound WhatsApp message with no active task-creation flow requiring an answer.

**Expected behavior**:
1. If no greeting was sent for the conversation on the current local day, send a greeting.
2. Send the main menu.

**Greeting examples**:
- Linked client: `Boa tarde, [Nome do cliente]. Seja bem-vindo(a) ao atendimento da Grow Contabilidade.`
- Unlinked contact: `Boa tarde. Ola, bem-vindo(a) a Grow Contabilidade.`

**Main menu body**:
`Para direcionarmos seu atendimento corretamente, escolha uma das opcoes abaixo.`

**Main menu actions**:
- `Falar com a equipe`
- `Solicitacoes`

## Human Attendance

**Trigger**: Client selects `Falar com a equipe` or equivalent free text intent.

**Inside office hours response**:
`Certo. Encaminhamos sua conversa para a equipe de atendimento. Em breve alguem da nossa equipe continuara por aqui.`

**Outside office hours response**:
`No momento, nosso horario de atendimento ja foi encerrado. Sua mensagem ficou registrada e retornaremos no proximo dia util, ou assim que possivel.`

**Internal outcome**:
- Conversation enters the attendance queue.
- WhatsApp module shows visual notification/unread marker.
- Conversation appears under the attendance tab.
- Office-hours check uses Monday to Friday until 17:00 local Sao Paulo time.

## Requests Menu

**Trigger**: Client selects `Solicitacoes`.

**Body**:
`Certo. Voce pode consultar solicitacoes em andamento ou abrir uma nova demanda para nossa equipe.`

**Actions**:
- `Consultar tarefas`
- `Nova solicitacao`

## Consult Open Tasks

**Trigger**: Client selects `Consultar tarefas`.

**Linked client with tasks**:
1. Send summary: `Localizamos [N] tarefa(s) em andamento para este cliente. Enviaremos os detalhes a seguir.`
2. Send one readable message per task, bounded by configured maximum.
3. Send final actions.

**Task message format**:
```text
*Tarefa em andamento [index]/[total]*

*Ticket:* #[ticket]
*Titulo:* [title]
*Status:* [status]

Para continuar esta tarefa, responda informando o ticket #[ticket].
```

**Linked client without tasks**:
`Nao localizamos tarefas em andamento para este cliente no momento.`

Then send final actions.

**Unlinked contact**:
`Nao localizamos um cliente vinculado a este numero. Para consultar tarefas em andamento, este contato precisa estar vinculado a um cliente cadastrado.`

Then offer human attendance or main menu.

## New Request

**Trigger**: Client selects `Nova solicitacao` or a specific active request type.

**Unlinked contact**:
`Para abrir uma nova solicitacao, precisamos primeiro identificar o cliente vinculado a este numero. Vamos direcionar sua conversa para a equipe.`

Then route to human attendance. Do not create a task automatically.

**If request types exist**:
- Show selectable request types ordered by configuration.
- Do not ask for internal sector directly.

**If no request type is selected yet**:
Ask the client to choose the request type.

**Required collection steps**:
1. Ask for a short title/summary if not already inferred from request type.
2. Ask for description/context.
3. Preserve attachments sent during the active flow.

**Cancellation**:
If the client sends `cancelar`, cancel the active flow and offer final actions.

**Confirmation format**:
```text
*Ticket de atendimento criado*

*Numero do ticket:* #[ticket]
*Titulo:* [title]
*Responsavel:* [responsible]

Recebemos sua solicitacao e nossa equipe dara continuidade ao atendimento por este ticket.
```

Then send final actions.

## Delivery Failure Handling

**Trigger**: Any automatic outbound message cannot be delivered due to WhatsApp provider or Meta policy failure.

**Internal behavior**:
- Record the failed outbound message and provider reason for internal diagnosis.
- Show a visible failure alert in the conversation.
- Stop the next automatic flow step until an internal user intervenes or an explicit valid retry path is triggered.

**Client-facing behavior**:
- Do not show the next automatic step as completed or delivered.
- Do not create a task or ticket based only on a failed confirmation message.

## Final Actions

**Body**:
`Como deseja prosseguir? Voce pode voltar ao menu principal para escolher outra opcao ou encerrar este atendimento automatico.`

**Actions**:
- `Voltar ao menu`
- `Encerrar`

## End Flow

**Trigger**: Client selects `Encerrar` in automatic flow.

**Response**:
`Certo. Encerramos este fluxo de atendimento automatico. Caso precise de algo mais, envie *menu* para ver as opcoes novamente.`

## Manual Attendance Closing

**Trigger**: Internal user manually ends attendance.

**Client-facing response**:
`Foi um prazer atende-lo. Para mantermos um bom atendimento, pedimos que avalie de 1 a 10 o atendimento recebido.`

**Important**:
- This closing message is institutional.
- It must not include attendant name/sector header.
