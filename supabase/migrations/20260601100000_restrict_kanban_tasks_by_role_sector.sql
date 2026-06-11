-- Restrict kanban task access by the user's department role inside the organization.

CREATE OR REPLACE FUNCTION public.normalize_task_sector(_sector text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  WITH cleaned AS (
    SELECT lower(
      trim(
        replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(
          coalesce(_sector, ''),
          'á', 'a'), 'à', 'a'), 'ã', 'a'), 'â', 'a'), 'ä', 'a'),
          'é', 'e'), 'ê', 'e'), 'í', 'i'), 'ó', 'o'), 'ç', 'c')
      )
    ) AS value
  )
  SELECT CASE
    WHEN value LIKE '%fiscal%' THEN 'fiscal'
    WHEN value LIKE '%pessoal%' OR value = 'dp' THEN 'departamento_pessoal'
    WHEN value LIKE '%contabil%' OR value LIKE '%contabilidade%' OR value LIKE '%contabil%' THEN 'contabil'
    WHEN value LIKE '%comercial%' THEN 'commercial'
    WHEN value LIKE '%geral%' OR value = '' THEN 'employee'
    ELSE value
  END
  FROM cleaned;
$$;

CREATE OR REPLACE FUNCTION public.can_access_task_sector(_user_id uuid, _organization_id uuid, _sector text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_org_role(_user_id, _organization_id, 'admin')
    OR public.has_org_role(_user_id, _organization_id, 'director')
    OR public.has_org_role(_user_id, _organization_id, 'manager')
    OR public.has_org_role(_user_id, _organization_id, 'partner')
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = _user_id
        AND ur.organization_id = _organization_id
        AND (
          (ur.role = 'fiscal' AND public.normalize_task_sector(_sector) = 'fiscal')
          OR (ur.role = 'departamento_pessoal' AND public.normalize_task_sector(_sector) = 'departamento_pessoal')
          OR (ur.role = 'contabil' AND public.normalize_task_sector(_sector) = 'contabil')
          OR (ur.role = 'commercial' AND public.normalize_task_sector(_sector) = 'commercial')
          OR (ur.role = 'employee' AND public.normalize_task_sector(_sector) = 'employee')
        )
    );
$$;

REVOKE ALL ON FUNCTION public.normalize_task_sector(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_task_sector(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.normalize_task_sector(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_task_sector(uuid, uuid, text) TO authenticated;

DROP POLICY IF EXISTS "Tenant internal can view kanban tasks" ON public.kanban_tasks;
DROP POLICY IF EXISTS "Tenant internal can insert kanban tasks" ON public.kanban_tasks;
DROP POLICY IF EXISTS "Tenant internal can update kanban tasks" ON public.kanban_tasks;
DROP POLICY IF EXISTS "Tenant managers can delete kanban tasks" ON public.kanban_tasks;
DROP POLICY IF EXISTS "Tenant role can view kanban tasks by sector" ON public.kanban_tasks;
DROP POLICY IF EXISTS "Tenant role can insert kanban tasks by sector" ON public.kanban_tasks;
DROP POLICY IF EXISTS "Tenant role can update kanban tasks by sector" ON public.kanban_tasks;
DROP POLICY IF EXISTS "Tenant managers can delete kanban tasks by sector" ON public.kanban_tasks;

CREATE POLICY "Tenant role can view kanban tasks by sector"
  ON public.kanban_tasks FOR SELECT TO authenticated
  USING (public.can_access_task_sector((select auth.uid()), organization_id, sector));

CREATE POLICY "Tenant role can insert kanban tasks by sector"
  ON public.kanban_tasks FOR INSERT TO authenticated
  WITH CHECK (public.can_access_task_sector((select auth.uid()), organization_id, sector));

CREATE POLICY "Tenant role can update kanban tasks by sector"
  ON public.kanban_tasks FOR UPDATE TO authenticated
  USING (public.can_access_task_sector((select auth.uid()), organization_id, sector))
  WITH CHECK (public.can_access_task_sector((select auth.uid()), organization_id, sector));

CREATE POLICY "Tenant managers can delete kanban tasks by sector"
  ON public.kanban_tasks FOR DELETE TO authenticated
  USING (
    public.has_org_role((select auth.uid()), organization_id, 'admin')
    OR public.has_org_role((select auth.uid()), organization_id, 'director')
    OR public.has_org_role((select auth.uid()), organization_id, 'manager')
  );
