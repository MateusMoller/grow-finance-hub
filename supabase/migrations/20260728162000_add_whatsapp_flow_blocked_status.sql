ALTER TABLE public.whatsapp_task_creation_flows
  DROP CONSTRAINT IF EXISTS whatsapp_task_creation_flows_status_check;

ALTER TABLE public.whatsapp_task_creation_flows
  ADD CONSTRAINT whatsapp_task_creation_flows_status_check
  CHECK (
    status IN (
      'collecting_sector',
      'collecting_title',
      'collecting_description',
      'completed',
      'cancelled',
      'expired',
      'blocked'
    )
  );

DROP INDEX IF EXISTS public.ux_whatsapp_task_creation_flows_active;
CREATE UNIQUE INDEX IF NOT EXISTS ux_whatsapp_task_creation_flows_active
  ON public.whatsapp_task_creation_flows (organization_id, conversation_id)
  WHERE status IN ('collecting_sector', 'collecting_title', 'collecting_description', 'blocked');

DROP INDEX IF EXISTS public.idx_whatsapp_task_creation_flows_expiry;
CREATE INDEX IF NOT EXISTS idx_whatsapp_task_creation_flows_expiry
  ON public.whatsapp_task_creation_flows (organization_id, expires_at)
  WHERE status IN ('collecting_sector', 'collecting_title', 'collecting_description', 'blocked');

ALTER TABLE public.whatsapp_conversation_events
  DROP CONSTRAINT IF EXISTS whatsapp_conversation_events_event_type_check;
