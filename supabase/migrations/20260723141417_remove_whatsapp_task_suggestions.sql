DROP POLICY IF EXISTS "WhatsApp users can read task suggestions" ON public.whatsapp_task_suggestions;
DROP POLICY IF EXISTS "WhatsApp users can manage task suggestions" ON public.whatsapp_task_suggestions;

DROP INDEX IF EXISTS public.idx_whatsapp_task_suggestions_queue;
DROP INDEX IF EXISTS public.ux_whatsapp_task_suggestions_source_pending;
DROP INDEX IF EXISTS public.ux_whatsapp_task_suggestions_idempotency;

DROP TABLE IF EXISTS public.whatsapp_task_suggestions;
