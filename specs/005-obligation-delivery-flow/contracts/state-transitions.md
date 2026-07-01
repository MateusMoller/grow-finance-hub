# Contract: Obligation Delivery State Transitions

## Instance Completion Rule

An obligation instance that requires client delivery may reach `concluida` only when:

1. The instance is linked to an active client and active obligation template.
2. All active required expected documents are attached or explicitly waived.
3. A valid primary or reviewed recipient email is present.
4. The final sender has a valid registered email identity for reply-to/audit.
5. An authorized user explicitly confirmed sending.
6. A delivery attempt has status `sent`.
7. The task/Kanban closure is performed in the same backend-controlled completion path.

## Document Inbox Rules

| Current State | Event | Next State | Notes |
|---------------|-------|------------|-------|
| `queued`/new | Match high confidence | `linked` | Requires client, template, instance, competence, and document type. |
| `queued`/new | Match ambiguous | `pending_review` | No send or completion. |
| `pending_review` | User accepts | `linked` | Records reviewer and notes. |
| `pending_review` | User rejects | `rejected` | Does not delete file. |
| `linked` | File attached and docs incomplete | `linked` | Instance remains awaiting document. |
| `linked` | File attached and docs complete | `linked` | Instance moves to ready-to-send state and awaits human confirmation. |

## Delivery Attempt Rules

| Current State | Event | Next State | Instance/Task Effect |
|---------------|-------|------------|----------------------|
| none | Prepare delivery | ready state | No completion and no client email. |
| ready | Authorized user confirms send | `sending` | Instance can show `enviando`. |
| sending | Provider success | `sent` | Instance `concluida`, task done. |
| sending | Provider failure | `failed` | Instance/task stay open and retryable. |
| failed | Retry starts | `sending` | New attempt keeps failure history. |
| sent | Duplicate send requested | blocked or confirm required | No automatic duplicate. |
| historical complete without email evidence | Reconciliation | review flag | Historical status is preserved. |

## Failure Handling

- Missing client email: block send, keep task open.
- Missing sender email: block send, keep task open.
- Missing human confirmation: block send, keep task open.
- Missing attachment: block send, keep task open.
- Provider failure: record failed attempt, keep task open.
- Unauthorized action: reject before any state change.
- Cross-organization/client mismatch: reject before any state change.
- Historical completed records without email evidence: preserve completion and flag delivery review/audit.

## Audit Requirements

Every accepted match, rejected match, send attempt, send success, send failure, retry, duplicate override, cancellation, and completion must record:

- actor user id
- organization id
- client id
- obligation instance id
- inbox item/file ids when applicable
- previous state
- next state
- timestamp
- sanitized provider/error metadata when applicable
