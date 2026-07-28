-- WhatsApp improved flow hardening.
-- Rollout notes:
-- 1. Apply before deploying the updated whatsapp-webhook function.
-- 2. Existing conversations remain valid; this only expands accepted states and indexes hot lookups.
-- 3. The task indexes support bounded client-scoped task consultation from WhatsApp.
--
-- Rollback notes:
-- 1. Move any delivery_blocked conversations back to open before restoring the old status check.
-- 2. Move any blocked task creation flows to cancelled before restoring the old flow status check.

ALTER TABLE public.whatsapp_conversations
  DROP CONSTRAINT IF EXISTS whatsapp_conversations_status_check;

ALTER TABLE public.whatsapp_conversations
  ADD CONSTRAINT whatsapp_conversations_status_check
  CHECK (status IN ('open', 'in_attendance', 'pending_client', 'resolved', 'archived', 'delivery_blocked'));

ALTER TABLE public.whatsapp_task_creation_flows
  ADD COLUMN IF NOT EXISTS blocked_at timestamptz,
  ADD COLUMN IF NOT EXISTS block_reason text;

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_delivery_blocked
  ON public.whatsapp_conversations (organization_id, updated_at DESC)
  WHERE status = 'delivery_blocked';

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_org_delivery_failed
  ON public.whatsapp_messages (organization_id, conversation_id, created_at DESC)
  WHERE delivery_status = 'failed' OR blocked_reason IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_attachments_message_status
  ON public.whatsapp_conversation_attachments (organization_id, message_id, status);

CREATE INDEX IF NOT EXISTS idx_whatsapp_task_message_links_attachment
  ON public.whatsapp_task_message_links (organization_id, attachment_id)
  WHERE attachment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_kanban_tasks_whatsapp_client_open
  ON public.kanban_tasks (organization_id, client_name, status, updated_at DESC)
  WHERE status NOT IN ('done', 'completed', 'concluido', 'concluído', 'archived', 'arquivo');

CREATE UNIQUE INDEX IF NOT EXISTS ux_kanban_tasks_whatsapp_flow
  ON public.kanban_tasks (organization_id, integration_task_id)
  WHERE integration_source = 'whatsapp' AND integration_task_id IS NOT NULL;
