-- Ensure only admins can see all kanban task sectors.
-- Non-admin users can only access tasks whose sector matches one of their department roles.

CREATE OR REPLACE FUNCTION public.normalize_task_sector(_sector text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  WITH cleaned AS (
    SELECT
      replace(replace(replace(replace(replace(
      replace(replace(replace(replace(
      replace(replace(replace(replace(
      replace(replace(replace(replace(replace(
      replace(trim(lower(coalesce(_sector, ''))),
        U&'\00E1', 'a'), U&'\00E0', 'a'), U&'\00E3', 'a'), U&'\00E2', 'a'), U&'\00E4', 'a'),
        U&'\00E9', 'e'), U&'\00E8', 'e'), U&'\00EA', 'e'), U&'\00EB', 'e'),
        U&'\00ED', 'i'), U&'\00EC', 'i'), U&'\00EE', 'i'), U&'\00EF', 'i'),
        U&'\00F3', 'o'), U&'\00F2', 'o'), U&'\00F5', 'o'), U&'\00F4', 'o'), U&'\00F6', 'o'),
        U&'\00E7', 'c') AS value
  )
  SELECT CASE
    WHEN value LIKE '%fiscal%' THEN 'fiscal'
    WHEN value LIKE '%pessoal%' OR value = 'dp' THEN 'departamento_pessoal'
    WHEN value LIKE '%contabil%' OR value LIKE '%contabilidade%' THEN 'contabil'
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
  WITH normalized AS (
    SELECT public.normalize_task_sector(_sector) AS sector
  )
  SELECT
    public.has_org_role(_user_id, _organization_id, 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      CROSS JOIN normalized n
      WHERE ur.user_id = _user_id
        AND ur.organization_id = _organization_id
        AND (
          (ur.role = 'fiscal' AND n.sector = 'fiscal')
          OR (ur.role = 'departamento_pessoal' AND n.sector = 'departamento_pessoal')
          OR (ur.role = 'contabil' AND n.sector = 'contabil')
          OR (ur.role = 'commercial' AND n.sector = 'commercial')
          OR (ur.role = 'employee' AND n.sector = 'employee')
        )
    );
$$;

REVOKE ALL ON FUNCTION public.normalize_task_sector(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_task_sector(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.normalize_task_sector(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_task_sector(uuid, uuid, text) TO authenticated;

DROP POLICY IF EXISTS "Tenant role can view kanban tasks by sector" ON public.kanban_tasks;
DROP POLICY IF EXISTS "Tenant role can insert kanban tasks by sector" ON public.kanban_tasks;
DROP POLICY IF EXISTS "Tenant role can update kanban tasks by sector" ON public.kanban_tasks;
DROP POLICY IF EXISTS "Tenant managers can delete kanban tasks by sector" ON public.kanban_tasks;
DROP POLICY IF EXISTS "Tenant admins can delete kanban tasks" ON public.kanban_tasks;

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

CREATE POLICY "Tenant admins can delete kanban tasks"
  ON public.kanban_tasks FOR DELETE TO authenticated
  USING (public.has_org_role((select auth.uid()), organization_id, 'admin'));
