CREATE TABLE IF NOT EXISTS public.kanban_task_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source_task_id uuid NOT NULL REFERENCES public.kanban_tasks(id) ON DELETE CASCADE,
  target_task_id uuid NOT NULL REFERENCES public.kanban_tasks(id) ON DELETE CASCADE,
  relation_type text NOT NULL DEFAULT 'related',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT kanban_task_relations_no_self CHECK (source_task_id <> target_task_id),
  CONSTRAINT kanban_task_relations_type_check CHECK (relation_type IN ('related'))
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_kanban_task_relations_pair
  ON public.kanban_task_relations (
    organization_id,
    LEAST(source_task_id, target_task_id),
    GREATEST(source_task_id, target_task_id),
    relation_type
  );

CREATE INDEX IF NOT EXISTS idx_kanban_task_relations_source
  ON public.kanban_task_relations (organization_id, source_task_id);

CREATE INDEX IF NOT EXISTS idx_kanban_task_relations_target
  ON public.kanban_task_relations (organization_id, target_task_id);

ALTER TABLE public.kanban_task_relations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users view related accessible tasks"
  ON public.kanban_task_relations
  FOR SELECT
  TO authenticated
  USING (
    public.can_access_kanban_task((SELECT auth.uid()), organization_id, source_task_id)
    OR public.can_access_kanban_task((SELECT auth.uid()), organization_id, target_task_id)
  );

CREATE POLICY "Tenant users create related accessible tasks"
  ON public.kanban_task_relations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_access_kanban_task((SELECT auth.uid()), organization_id, source_task_id)
    AND public.can_access_kanban_task((SELECT auth.uid()), organization_id, target_task_id)
  );

CREATE POLICY "Tenant users delete related accessible tasks"
  ON public.kanban_task_relations
  FOR DELETE
  TO authenticated
  USING (
    public.can_access_kanban_task((SELECT auth.uid()), organization_id, source_task_id)
    AND public.can_access_kanban_task((SELECT auth.uid()), organization_id, target_task_id)
  );
