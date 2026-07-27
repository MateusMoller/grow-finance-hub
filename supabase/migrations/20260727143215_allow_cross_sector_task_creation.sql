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
          AND access.sector_code = public.canonical_task_sector(_sector)
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

CREATE OR REPLACE FUNCTION public.can_create_task_values(
  _user_id uuid,
  _organization_id uuid
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
      )
    );
$$;

DROP POLICY IF EXISTS "Tenant users insert canonical task scope" ON public.kanban_tasks;

CREATE POLICY "Tenant users insert canonical task scope"
  ON public.kanban_tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_create_task_values(
      (SELECT auth.uid()),
      organization_id
    )
  );

REVOKE ALL ON FUNCTION public.can_create_task_values(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_create_task_values(uuid, uuid) TO authenticated;
