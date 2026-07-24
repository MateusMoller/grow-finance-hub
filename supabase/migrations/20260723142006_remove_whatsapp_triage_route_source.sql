UPDATE public.whatsapp_task_message_links
SET route_source = NULL
WHERE route_source = 'triage';

ALTER TABLE public.whatsapp_task_message_links
DROP CONSTRAINT IF EXISTS whatsapp_task_message_links_route_source_check;

ALTER TABLE public.whatsapp_task_message_links
ADD CONSTRAINT whatsapp_task_message_links_route_source_check
CHECK (
  route_source IN (
    'quoted_reply',
    'interactive_selection',
    'protocol',
    'active_context',
    'inference',
    'unrouted'
  )
  OR route_source IS NULL
);
