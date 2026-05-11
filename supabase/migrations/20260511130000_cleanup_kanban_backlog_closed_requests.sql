-- Clean Kanban inbox safely:
-- Move only backlog tasks linked to closed client requests out of inbox.
-- No row is deleted; only status is updated.

UPDATE public.kanban_tasks AS kt
SET
  status = 'archived',
  updated_at = now()
WHERE
  kt.status = 'backlog'
  AND EXISTS (
    SELECT 1
    FROM public.client_requests AS cr
    WHERE cr.id = kt.request_id
      AND cr.status IN ('completed', 'cancelled')
  );
