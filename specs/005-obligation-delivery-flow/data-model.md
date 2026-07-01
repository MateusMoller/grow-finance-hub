# Data Model: Obligation Delivery Flow

This model describes the target behavior on top of existing tables. It favors additive changes and reconciliation over replacement.

## Existing Entities To Preserve

### Obligation Template (`obligation_templates`)

Represents the reusable obligation catalog record.

Key fields already present or expected:

- `organization_id`
- `code`, `name`, `sector`
- `periodicity`, `competence_reference`, `technical_due_month_reference`
- `due_day`, `legal_due_day`, `yearly_due_month`
- `priority`
- `expected_documents`
- `requires_document`, `generates_calendar`, `generates_kanban`
- `completion_email_enabled`, `completion_email_subject`, `completion_email_body`
- `completion_whatsapp_enabled`, `completion_whatsapp_body`
- `is_active`

Validation:

- Active sendable obligations must have at least one active expected document when `requires_document` is true.
- Email-enabled obligations must have a valid subject and body template.
- Expected document keys must be unique within a template.

## Expected Document

JSON item inside `obligation_templates.expected_documents` and optional profile override.

Fields:

- `document_type_key`
- `label`
- `aliases`
- `required`
- `active`

Rules:

- Reference files attached to this document are extraction templates only.
- Active required documents must be present or waived before delivery.

## Reference File (`expected_document_reference_files`)

Represents internal document model files used for extraction and matching.

Fields:

- `organization_id`
- `template_id`
- `profile_id`
- `document_type_key`
- `storage_bucket`, `storage_path`
- `extracted_text`, `fingerprint_payload`, `keywords`, `primary_cues`
- `is_active`
- extraction status fields

Rules:

- Reference files are never client delivery attachments.
- Only internal users can manage them.

## Client Obligation Profile (`client_obligation_profiles`)

Links a client to an obligation template and stores client-specific overrides.

Fields:

- `organization_id`
- `client_id`
- `template_id`
- `assigned_to`
- due date overrides
- `expected_documents_override`
- `is_active`, `start_date`, `end_date`

Rules:

- Active profiles generate tracked obligation instances.
- Profile scope must match organization and client.

## Obligation Instance (`obligation_instances`)

Represents one obligation for one client and one competence.

Fields:

- `organization_id`
- `client_id`, `profile_id`, `template_id`
- `competence_label`, `competence_date`, `competence_key`
- `technical_due_date`, `legal_due_date`
- `status`
- `document_required`
- `current_assignee`
- `completed_at`
- `completed_by_inbox_item_id`
- `processed_automatically`

Target statuses:

- `pendente`
- `em_andamento`
- `aguardando_documento`
- `em_revisao`
- `pronto_para_envio`
- `enviando`
- `concluida`
- `atrasada`
- `falha_envio`
- `cancelada`

Rules:

- Unique per organization/client/template/competence.
- Must not become `concluida` until a successful delivery attempt exists when client email delivery is required.
- Failed email keeps the instance open in `falha_envio` or another retryable non-complete status.

## Document Ingestion Job (`document_ingestion_jobs`)

Represents each uploaded/robot-detected file processing job.

Fields:

- `organization_id`
- `source_kind`
- `status`
- `classification_status`
- `application_status`
- `communication_status`
- `publication_status`
- `client_id`, `detected_client_id`
- `template_id`, `instance_id`, `inbox_item_id`
- `storage_bucket`, `storage_path`, `file_hash`, `file_size`
- `review_required`
- `attempts`, `last_error`
- `created_by`

Rules:

- File storage path should be unique.
- Batch upload must show per-file job status.
- Job failure must not mark obligation complete.

## Document Inbox Item (`document_inbox_items`)

Represents the operational inbox item used for matching, review, and application.

Fields:

- `organization_id`
- `client_id`, `detected_client_id`, `suggested_client_id`
- `suggested_template_id`, `suggested_instance_id`, `linked_instance_id`
- `document_type_key`
- `storage_bucket`, `storage_path`, `file_hash`, `content_type`, `file_size`
- confidence and match reason fields
- `status`
- `classification_status`, `application_status`, `communication_status`, `publication_status`
- `processing_status`, `execution_status`, `last_processing_error`
- `created_by`, `reviewed_by`, `reviewed_at`

Target flow:

1. `pending_review` when match is ambiguous or incomplete.
2. `linked` when client/obligation/competence/document type are confirmed.
3. `rejected` when not valid for the obligation flow.

Rules:

- Low-confidence or conflicting matches require review.
- Linked item can attach a file and prepare a delivery, but must not force completion before email success.

## Obligation Instance File (`obligation_instance_files`)

Represents the actual guide or supporting document attached to an obligation instance.

Fields:

- `organization_id`
- `instance_id`
- `inbox_item_id`
- `storage_bucket`, `storage_path`
- `file_name`, `content_type`, `file_size`
- `document_type_key` if added/formalized
- `triage_status`
- `source_kind`
- `uploaded_by`
- `publication_status`

Rules:

- Unique by storage bucket/path.
- Sendable file is this attached guide, not a reference template.

## Delivery Attempt (new or formalized durable entity)

Represents one attempt to send matched guide files to a client.

Suggested fields:

- `id`
- `organization_id`
- `client_id`
- `instance_id`
- `inbox_item_id`
- `sender_user_id`
- `sender_email`
- `verified_from_email`
- `display_sender_context`
- `reply_to`
- `recipient_email`
- `subject`
- `message_body`
- `attachment_file_ids`
- `status`: `queued`, `sending`, `sent`, `failed`, `cancelled`
- `provider_message_id`
- `provider_status`
- `failure_reason`
- `idempotency_key`
- `human_confirmed_at`
- `historical_review_required`
- `created_at`, `sent_at`, `failed_at`

Rules:

- Successful attempts are idempotent by instance, inbox item/file set, recipient, and sender action.
- New sends require explicit human confirmation before provider delivery.
- The default recipient is the client's primary registered email unless an authorized user reviews and edits it before confirmation.
- The email `From` address is a verified Grow sender; the acting user's registered email is stored as reply-to and audit identity.
- A failed attempt can be retried without deleting history.
- A duplicate successful send requires explicit confirmation.

## Operational Task / Kanban Task (`kanban_tasks`)

Represents operational tracking generated from obligations.

Rules:

- Generated task must be idempotent by obligation instance or equivalent integration key.
- Task closes only after the obligation instance reaches final completion through successful client delivery.
- Direct task status edits must not bypass backend completion rules for delivery-required obligations.

## Audit/Event (`obligation_instance_events`)

Represents status changes, review decisions, send attempts, failures, retries, and completion.

Rules:

- Every sensitive transition records actor, organization/client/instance, previous state, next state, and metadata.
- Provider errors are sanitized before storage and UI display.

## State Transition Summary

```text
Obligation template active
  -> profile applies to client
  -> instance/task generated
  -> awaiting document
  -> document uploaded
  -> matched or manual review
  -> linked and all required documents present
  -> ready to send
  -> sending
  -> sent and instance/task completed
```

Failure paths:

- Match failure: `pending_review`, no email, task open.
- Missing client email: ready/review state with clear action required, task open.
- Missing sender email: send blocked, task open.
- Missing human confirmation: send blocked, task open.
- Provider failure: delivery attempt `failed`, instance/task open and retryable.
- Duplicate detected: warn/require confirmation before another attempt.
- Historical completed instance without email evidence: keep historical status and set delivery review/audit flag.
