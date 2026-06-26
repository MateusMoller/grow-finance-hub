CREATE OR REPLACE FUNCTION public.can_access_task_values(
  _user_id uuid,
  _organization_id uuid,
  _sector text,
  _assigned_to_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_canonical_org_role(_user_id, _organization_id, 'admin')
    OR (
      public.has_effective_module_access(_user_id, _organization_id, 'tarefas')
      AND EXISTS (
        SELECT 1
        FROM public.organization_user_access access
        WHERE access.organization_id = _organization_id
          AND access.user_id = _user_id
          AND access.primary_role = 'colaborador'
          AND access.status = 'active'
          AND NOT access.requires_access_review
          AND (
            access.sector_code = public.canonical_task_sector(_sector)
            OR _assigned_to_user_id = _user_id
          )
      )
    )
    OR (
      NOT EXISTS (
        SELECT 1
        FROM public.organization_user_access access
        WHERE access.organization_id = _organization_id
          AND access.user_id = _user_id
      )
      AND public.can_access_task_sector(_user_id, _organization_id, _sector)
    );
$$;

CREATE OR REPLACE FUNCTION public.can_access_kanban_task(
  _user_id uuid,
  _organization_id uuid,
  _task_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.kanban_tasks task
    WHERE task.id = _task_id
      AND task.organization_id = _organization_id
      AND public.can_access_task_values(
        _user_id,
        task.organization_id,
        task.sector,
        task.assigned_to_user_id
      )
  );
$$;

DROP POLICY IF EXISTS "Tenant role can view kanban tasks by sector" ON public.kanban_tasks;
DROP POLICY IF EXISTS "Tenant role can insert kanban tasks by sector" ON public.kanban_tasks;
DROP POLICY IF EXISTS "Tenant role can update kanban tasks by sector" ON public.kanban_tasks;
DROP POLICY IF EXISTS "Tenant admins can delete kanban tasks" ON public.kanban_tasks;

CREATE POLICY "Tenant users view canonical task scope"
  ON public.kanban_tasks
  FOR SELECT
  TO authenticated
  USING (
    public.can_access_task_values(
      (SELECT auth.uid()),
      organization_id,
      sector,
      assigned_to_user_id
    )
  );

CREATE POLICY "Tenant users insert canonical task scope"
  ON public.kanban_tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_access_task_values(
      (SELECT auth.uid()),
      organization_id,
      sector,
      assigned_to_user_id
    )
  );

CREATE POLICY "Tenant users update canonical task scope"
  ON public.kanban_tasks
  FOR UPDATE
  TO authenticated
  USING (
    public.can_access_task_values(
      (SELECT auth.uid()),
      organization_id,
      sector,
      assigned_to_user_id
    )
  )
  WITH CHECK (
    public.can_access_task_values(
      (SELECT auth.uid()),
      organization_id,
      sector,
      assigned_to_user_id
    )
  );

CREATE POLICY "Tenant admins delete canonical tasks"
  ON public.kanban_tasks
  FOR DELETE
  TO authenticated
  USING (
    public.has_canonical_org_role(
      (SELECT auth.uid()),
      organization_id,
      'admin'
    )
    OR public.has_org_role(
      (SELECT auth.uid()),
      organization_id,
      'admin'::public.app_role
    )
  );

DROP POLICY IF EXISTS "Tenant role can view task comments by sector" ON public.kanban_task_comments;
DROP POLICY IF EXISTS "Tenant role can insert task comments by sector" ON public.kanban_task_comments;
DROP POLICY IF EXISTS "Tenant role can update own task comments by sector" ON public.kanban_task_comments;
DROP POLICY IF EXISTS "Tenant admins can delete task comments" ON public.kanban_task_comments;

CREATE POLICY "Tenant users view comments for accessible tasks"
  ON public.kanban_task_comments
  FOR SELECT
  TO authenticated
  USING (
    public.can_access_kanban_task(
      (SELECT auth.uid()),
      organization_id,
      task_id
    )
  );

CREATE POLICY "Tenant users add comments to accessible tasks"
  ON public.kanban_task_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND public.can_access_kanban_task(
      (SELECT auth.uid()),
      organization_id,
      task_id
    )
  );

CREATE POLICY "Tenant users update own comments for accessible tasks"
  ON public.kanban_task_comments
  FOR UPDATE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND public.can_access_kanban_task(
      (SELECT auth.uid()),
      organization_id,
      task_id
    )
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND public.can_access_kanban_task(
      (SELECT auth.uid()),
      organization_id,
      task_id
    )
  );

CREATE POLICY "Tenant admins delete canonical task comments"
  ON public.kanban_task_comments
  FOR DELETE
  TO authenticated
  USING (
    public.has_canonical_org_role(
      (SELECT auth.uid()),
      organization_id,
      'admin'
    )
    OR public.has_org_role(
      (SELECT auth.uid()),
      organization_id,
      'admin'::public.app_role
    )
  );

DROP POLICY IF EXISTS "Tenant internal can view calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS "Tenant internal can insert calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS "Tenant internal can update calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS "Tenant managers can delete calendar events" ON public.calendar_events;

CREATE POLICY "Tenant users view canonical calendar scope"
  ON public.calendar_events
  FOR SELECT
  TO authenticated
  USING (
    public.has_canonical_org_role((SELECT auth.uid()), organization_id, 'admin')
    OR (
      public.has_effective_module_access((SELECT auth.uid()), organization_id, 'calendario')
      AND EXISTS (
        SELECT 1
        FROM public.organization_user_access access
        WHERE access.organization_id = calendar_events.organization_id
          AND access.user_id = (SELECT auth.uid())
          AND access.primary_role = 'colaborador'
          AND access.status = 'active'
          AND NOT access.requires_access_review
          AND access.sector_code = public.canonical_task_sector(calendar_events.sector)
      )
    )
    OR (
      NOT EXISTS (
        SELECT 1
        FROM public.organization_user_access access
        WHERE access.organization_id = calendar_events.organization_id
          AND access.user_id = (SELECT auth.uid())
      )
      AND public.is_internal_user((SELECT auth.uid()), organization_id)
    )
  );

CREATE POLICY "Tenant users insert canonical calendar scope"
  ON public.calendar_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_canonical_org_role((SELECT auth.uid()), organization_id, 'admin')
    OR (
      public.has_effective_module_access((SELECT auth.uid()), organization_id, 'calendario')
      AND EXISTS (
        SELECT 1
        FROM public.organization_user_access access
        WHERE access.organization_id = calendar_events.organization_id
          AND access.user_id = (SELECT auth.uid())
          AND access.primary_role = 'colaborador'
          AND access.status = 'active'
          AND NOT access.requires_access_review
          AND access.sector_code = public.canonical_task_sector(calendar_events.sector)
      )
    )
    OR (
      NOT EXISTS (
        SELECT 1
        FROM public.organization_user_access access
        WHERE access.organization_id = calendar_events.organization_id
          AND access.user_id = (SELECT auth.uid())
      )
      AND public.is_internal_user((SELECT auth.uid()), organization_id)
    )
  );

CREATE POLICY "Tenant users update canonical calendar scope"
  ON public.calendar_events
  FOR UPDATE
  TO authenticated
  USING (
    public.has_canonical_org_role((SELECT auth.uid()), organization_id, 'admin')
    OR (
      public.has_effective_module_access((SELECT auth.uid()), organization_id, 'calendario')
      AND EXISTS (
        SELECT 1
        FROM public.organization_user_access access
        WHERE access.organization_id = calendar_events.organization_id
          AND access.user_id = (SELECT auth.uid())
          AND access.primary_role = 'colaborador'
          AND access.status = 'active'
          AND NOT access.requires_access_review
          AND access.sector_code = public.canonical_task_sector(calendar_events.sector)
      )
    )
    OR (
      NOT EXISTS (
        SELECT 1
        FROM public.organization_user_access access
        WHERE access.organization_id = calendar_events.organization_id
          AND access.user_id = (SELECT auth.uid())
      )
      AND public.is_internal_user((SELECT auth.uid()), organization_id)
    )
  )
  WITH CHECK (
    public.has_canonical_org_role((SELECT auth.uid()), organization_id, 'admin')
    OR (
      public.has_effective_module_access((SELECT auth.uid()), organization_id, 'calendario')
      AND EXISTS (
        SELECT 1
        FROM public.organization_user_access access
        WHERE access.organization_id = calendar_events.organization_id
          AND access.user_id = (SELECT auth.uid())
          AND access.primary_role = 'colaborador'
          AND access.status = 'active'
          AND NOT access.requires_access_review
          AND access.sector_code = public.canonical_task_sector(calendar_events.sector)
      )
    )
    OR (
      NOT EXISTS (
        SELECT 1
        FROM public.organization_user_access access
        WHERE access.organization_id = calendar_events.organization_id
          AND access.user_id = (SELECT auth.uid())
      )
      AND public.is_internal_user((SELECT auth.uid()), organization_id)
    )
  );

CREATE POLICY "Tenant admins delete canonical calendar events"
  ON public.calendar_events
  FOR DELETE
  TO authenticated
  USING (
    public.has_canonical_org_role((SELECT auth.uid()), organization_id, 'admin')
    OR (
      NOT EXISTS (
        SELECT 1
        FROM public.organization_user_access access
        WHERE access.organization_id = calendar_events.organization_id
          AND access.user_id = (SELECT auth.uid())
      )
      AND public.has_org_role(
        (SELECT auth.uid()),
        organization_id,
        'admin'::public.app_role
      )
    )
  );

REVOKE ALL ON FUNCTION public.can_access_task_values(uuid, uuid, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_kanban_task(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_task_values(uuid, uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_kanban_task(uuid, uuid, uuid) TO authenticated;
