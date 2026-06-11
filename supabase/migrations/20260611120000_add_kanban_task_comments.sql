-- Add persistent per-task chat for Kanban/Tarefas.

CREATE TABLE IF NOT EXISTS public.kanban_task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT DEFAULT public.default_organization_id(),
  task_id uuid NOT NULL REFERENCES public.kanban_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT kanban_task_comments_content_length CHECK (char_length(trim(content)) > 0 AND char_length(content) <= 4000)
);

CREATE INDEX IF NOT EXISTS idx_kanban_task_comments_task_created_at
  ON public.kanban_task_comments (task_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_kanban_task_comments_organization_id
  ON public.kanban_task_comments (organization_id);

DROP TRIGGER IF EXISTS update_kanban_task_comments_updated_at ON public.kanban_task_comments;
CREATE TRIGGER update_kanban_task_comments_updated_at
  BEFORE UPDATE ON public.kanban_task_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.kanban_task_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant role can view task comments by sector" ON public.kanban_task_comments;
DROP POLICY IF EXISTS "Tenant role can insert task comments by sector" ON public.kanban_task_comments;
DROP POLICY IF EXISTS "Tenant role can update own task comments by sector" ON public.kanban_task_comments;
DROP POLICY IF EXISTS "Tenant admins can delete task comments" ON public.kanban_task_comments;

CREATE POLICY "Tenant role can view task comments by sector"
  ON public.kanban_task_comments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.kanban_tasks kt
      WHERE kt.id = kanban_task_comments.task_id
        AND kt.organization_id = kanban_task_comments.organization_id
        AND public.can_access_task_sector((select auth.uid()), kt.organization_id, kt.sector)
    )
  );

CREATE POLICY "Tenant role can insert task comments by sector"
  ON public.kanban_task_comments FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.kanban_tasks kt
      WHERE kt.id = kanban_task_comments.task_id
        AND kt.organization_id = kanban_task_comments.organization_id
        AND public.can_access_task_sector((select auth.uid()), kt.organization_id, kt.sector)
    )
  );

CREATE POLICY "Tenant role can update own task comments by sector"
  ON public.kanban_task_comments FOR UPDATE TO authenticated
  USING (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.kanban_tasks kt
      WHERE kt.id = kanban_task_comments.task_id
        AND kt.organization_id = kanban_task_comments.organization_id
        AND public.can_access_task_sector((select auth.uid()), kt.organization_id, kt.sector)
    )
  )
  WITH CHECK (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.kanban_tasks kt
      WHERE kt.id = kanban_task_comments.task_id
        AND kt.organization_id = kanban_task_comments.organization_id
        AND public.can_access_task_sector((select auth.uid()), kt.organization_id, kt.sector)
    )
  );

CREATE POLICY "Tenant admins can delete task comments"
  ON public.kanban_task_comments FOR DELETE TO authenticated
  USING (public.has_org_role((select auth.uid()), organization_id, 'admin'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'kanban_task_comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.kanban_task_comments;
  END IF;
END
$$;
