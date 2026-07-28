# Research: Improved WhatsApp Message Flow

## Decision: Keep the flow fixed for this feature

**Rationale**: The current operational need is to make the existing WhatsApp service reliable, professional, and easy to follow. A fully editable flow builder would add a much larger surface: validation, versioning, preview, permissions, testing, rollback, and support for invalid user-created paths. A fixed improved flow lets Grow stabilize client experience first.

**Alternatives considered**:
- Fully editable visual flow builder: deferred because it is broader than the immediate problem and raises failure-mode risk.
- Per-client custom flows: deferred because it would complicate support and audit without proven need.

## Decision: Use request types instead of exposing sectors to clients

**Rationale**: Clients usually understand what they need, not Grow's internal department structure. Request types such as "Nota fiscal", "Admissao", and "Demissao" are easier for clients and can map internally to the responsible sector.

**Alternatives considered**:
- Ask for sector first: rejected because it leaks internal organization and increases wrong routing.
- Free-text only: rejected because it creates inconsistent task quality.

## Decision: Use two top-level choices

**Rationale**: The main menu should reduce cognitive load and avoid a technical tree. The two primary intents are human service and requests.

**Alternatives considered**:
- More than two main menu buttons: rejected because WhatsApp button space is limited and more options slow client decisions.
- Start directly with request types: rejected because human attendance must remain obvious.

## Decision: Keep daily greeting separate from the main menu

**Rationale**: The greeting is relationship-building and should happen only once per day. Separating it from the menu makes idempotency easier to audit and prevents repeated greetings in active conversations.

**Alternatives considered**:
- Combine greeting and menu in one message: acceptable, but harder to avoid repeated greeting when resending menus.
- No greeting: rejected because the user explicitly wants a professional greeting.

## Decision: After-flow actions are always "Voltar ao menu" and "Encerrar"

**Rationale**: Consistent closing choices reduce dead ends and make flows predictable. This applies after consultation, task creation, cancellation, and no-result states.

**Alternatives considered**:
- Context-specific return labels such as "Voltar tarefas": rejected because the user requested "Voltar menu" consistently.
- End automatically after each action: rejected because clients often need more than one request.

## Decision: Human attendance is Monday-Friday until 17:00 and still enters the queue outside hours

**Rationale**: The client must receive a clear after-hours message when the office is closed, but the internal team must still see the pending conversation. Otherwise the request may be lost. The first version uses Monday to Friday until 17:00 local Sao Paulo time and leaves start time and holidays for later refinement.

**Alternatives considered**:
- Do not queue outside office hours: rejected because it loses operational visibility.
- Always answer as if online: rejected because it creates unrealistic response expectations.

## Decision: Require linked client before WhatsApp task creation

**Rationale**: WhatsApp task creation and task consultation expose operational client context. Requiring a reliable contact-to-client link avoids orphan tasks, wrong-client routing, and accidental exposure of task information.

**Alternatives considered**:
- Create generic tasks without a client: rejected because it creates ambiguous work and weak auditability.
- Create tasks under a placeholder client: rejected because it can hide the need to properly identify the requester.

## Decision: Preserve provider failures internally and stop automatic progression

**Rationale**: WhatsApp provider constraints can block delivery. The internal UI must show failures clearly, and the workflow must not advance as if the client had received the blocked message. Stopping the next automatic step prevents ghost flows, duplicate retries, and misleading history.

**Alternatives considered**:
- Hide provider failures: rejected because it impairs support.
- Expose raw provider errors to the client: impossible when delivery fails and poor UX internally.
- Retry automatically without human visibility: rejected because it can create duplicate messages and provider-limit loops.

## Decision: Bound task consultation results

**Rationale**: Some clients may have many open tasks. WhatsApp messages must stay readable and Edge Functions must avoid unnecessary load. A bounded list with a fallback to human attendance is more reliable.

**Alternatives considered**:
- Send every open task: rejected because it can spam clients and exceed practical message limits.
- Only show the latest task: rejected because clients may need to choose among active requests.
