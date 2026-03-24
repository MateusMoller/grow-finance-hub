-- Store external task identifiers for idempotent integrations (Conecta Chat)
ALTER TABLE public.kanban_tasks
  ADD COLUMN IF NOT EXISTS integration_source text,
  ADD COLUMN IF NOT EXISTS integration_task_id text,
  ADD COLUMN IF NOT EXISTS integration_payload jsonb;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'kanban_tasks_integration_source_task_id_key'
  ) THEN
    ALTER TABLE public.kanban_tasks
      ADD CONSTRAINT kanban_tasks_integration_source_task_id_key
      UNIQUE (integration_source, integration_task_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_kanban_tasks_integration_source
  ON public.kanban_tasks (integration_source);
