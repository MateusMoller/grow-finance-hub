-- Keep the client-facing request lifecycle aligned with the operational task.
-- The request is the portal record; the Kanban task remains the operational
-- source of truth for work performed by the internal team.
CREATE OR REPLACE FUNCTION public.sync_client_request_status_from_kanban_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.request_id IS NULL OR NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'done' THEN
    UPDATE public.client_requests
    SET status = 'completed'
    WHERE id = NEW.request_id
      AND status IS DISTINCT FROM 'completed'::public.request_status;
  ELSIF OLD.status = 'done' AND NEW.status <> 'archived' THEN
    UPDATE public.client_requests
    SET status = CASE
      WHEN NEW.status = 'backlog' THEN 'pending'::public.request_status
      ELSE 'in_progress'::public.request_status
    END
    WHERE id = NEW.request_id
      AND status = 'completed'::public.request_status;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_client_request_status_from_kanban_task() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sync_client_request_status_after_task_change ON public.kanban_tasks;
CREATE TRIGGER sync_client_request_status_after_task_change
AFTER UPDATE OF status ON public.kanban_tasks
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.request_id IS NOT NULL)
EXECUTE FUNCTION public.sync_client_request_status_from_kanban_task();

-- Repair requests whose operational task had already been concluded before
-- the synchronization trigger existed.
UPDATE public.client_requests AS request
SET status = 'completed'
WHERE request.status IS DISTINCT FROM 'completed'::public.request_status
  AND EXISTS (
    SELECT 1
    FROM public.kanban_tasks AS task
    WHERE task.request_id = request.id
      AND task.status = 'done'
  );
