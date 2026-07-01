# Contract: Obligation Edge Function Actions

The existing `grow-obligations-module` Edge Function remains the main backend boundary for internal obligation operations. Actions below document the expected request/response behavior for planning and task generation.

All actions:

- Require authenticated user JWT.
- Require an internal user with permission for the target organization.
- Require `organization_id` unless the action only reads the user's default authorized organization.
- Return JSON.
- Must not expose service-role secrets or provider credentials.

## Existing Actions To Preserve

### `overview`

Purpose: Load internal workspace data for catalog, instances, documents, and summary.

Request:

```json
{
  "action": "overview",
  "organization_id": "uuid",
  "filters": {
    "status": "optional",
    "client_id": "optional uuid",
    "template_id": "optional uuid",
    "competence_key": "optional"
  },
  "page": 1,
  "page_size": 50
}
```

Response:

```json
{
  "ok": true,
  "templates": [],
  "instances": [],
  "documents": [],
  "summary": {}
}
```

### `upsert_template`

Purpose: Create/update obligation catalog record, expected documents, and message templates.

Required behavior:

- Validate expected document uniqueness.
- Validate email template fields when email delivery is enabled.
- Preserve reference files unless explicitly deleted.

### `generate_instances`

Purpose: Generate obligation instances and operational tasks for active profiles/clients/competence.

Required behavior:

- Idempotent by organization/client/template/competence.
- Creates or updates linked operational task without duplicates.
- Does not close tasks.

### `register_document_upload` / `register_robot_document_upload`

Purpose: Register a guide uploaded by the internal UI, API, or local robot.

Required behavior:

- Create or reuse ingestion job by storage path/hash.
- Create or update document inbox item.
- Match client, obligation, competence, and document type when confidence is sufficient.
- Put ambiguous items in review.

### `preview_document_match`

Purpose: Return a non-mutating preview of document routing before registration or review.

Required behavior:

- Never sends email.
- Never completes an instance/task.
- Returns confidence and reasons.

### `resolve_document`

Purpose: Accept or reject a reviewed inbox item.

Required behavior:

- On accept, link item to an obligation instance and document type.
- Attach the guide file to the instance.
- Move item/instance to ready state when all required docs are present.
- Must not mark the instance/task complete unless a successful delivery attempt exists.

### `process_document_queue`

Purpose: Process queued linked documents.

Required behavior:

- Apply matched files.
- Prepare delivery state.
- Never auto-send to the client; linked documents may become ready for an authorized user's explicit send confirmation.
- Keep task/instance open on any email failure.

## New Or Formalized Actions

### `prepare_delivery`

Purpose: Build the final client delivery preview from linked documents and default message.

Request:

```json
{
  "action": "prepare_delivery",
  "organization_id": "uuid",
  "instance_id": "uuid",
  "inbox_item_id": "optional uuid"
}
```

Response:

```json
{
  "ok": true,
  "delivery": {
    "instance_id": "uuid",
    "client_id": "uuid",
    "recipient_email": "cliente@example.com",
    "verified_from_email": "obrigacoes@grow.example",
    "reply_to_email": "usuario@grow.com",
    "display_sender_context": "Usuario Grow <usuario@grow.com>",
    "subject": "string",
    "message_body": "string",
    "attachments": [
      {
        "file_id": "uuid",
        "file_name": "guia.pdf",
        "document_type_key": "das"
      }
    ],
    "warnings": []
  }
}
```

Failure responses:

- `400 missing_required_documents`
- `400 missing_client_email`
- `400 missing_sender_email`
- `400 missing_human_confirmation`
- `409 duplicate_delivery`
- `403 forbidden`

### `send_delivery`

Purpose: Send guide attachments to the client and close the obligation instance/task only after provider success.

Request:

```json
{
  "action": "send_delivery",
  "organization_id": "uuid",
  "instance_id": "uuid",
  "inbox_item_id": "optional uuid",
  "human_confirmed": true,
  "recipient_email": "optional reviewed recipient email",
  "confirmed_duplicate": false,
  "message_override": {
    "subject": "optional",
    "body": "optional"
  }
}
```

Success response:

```json
{
  "ok": true,
  "delivery_attempt": {
    "id": "uuid",
    "status": "sent",
    "provider_message_id": "provider-id",
    "sent_at": "iso timestamp"
  },
  "instance": {
    "id": "uuid",
    "status": "concluida",
    "completed_at": "iso timestamp"
  },
  "task": {
    "status": "done"
  }
}
```

Failure response:

```json
{
  "ok": false,
  "error": "provider_error",
  "message": "E-mail nao enviado. A tarefa permanece aberta.",
  "delivery_attempt": {
    "id": "uuid",
    "status": "failed"
  }
}
```

Required behavior:

- Requires explicit human confirmation from an authorized internal user.
- Uses a verified Grow sender address as `From`.
- Uses the authenticated final sender's registered email as reply-to, displayed sender context, and audit identity.
- Defaults recipient to the client's primary registered email unless a valid reviewed recipient is supplied.
- Attaches sendable guide files only.
- Creates an audit/event row for attempt result.
- Does not complete the obligation/task on failure.

### `retry_delivery`

Purpose: Retry a failed delivery without re-uploading the document.

Request:

```json
{
  "action": "retry_delivery",
  "organization_id": "uuid",
  "delivery_attempt_id": "uuid"
}
```

Required behavior:

- Revalidates sender, recipient, human confirmation, attachments, organization, client, and current instance status.
- Creates a new attempt or increments retry history without erasing the failed attempt.

### `cancel_delivery`

Purpose: Cancel an invalid or obsolete pending delivery path.

Request:

```json
{
  "action": "cancel_delivery",
  "organization_id": "uuid",
  "instance_id": "uuid",
  "reason": "string"
}
```

Required behavior:

- Requires authorized internal user.
- Records audit reason.
- Does not delete source documents.
