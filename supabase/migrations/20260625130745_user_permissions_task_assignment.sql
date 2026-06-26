ALTER TABLE public.kanban_tasks
  ADD COLUMN IF NOT EXISTS assigned_to_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_kanban_tasks_org_status_sector
  ON public.kanban_tasks (organization_id, status, sector);
CREATE INDEX IF NOT EXISTS idx_kanban_tasks_org_assignee_status
  ON public.kanban_tasks (organization_id, assigned_to_user_id, status);

CREATE OR REPLACE FUNCTION public.canonical_task_sector(_sector text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  WITH cleaned AS (
    SELECT translate(
      lower(trim(COALESCE(_sector, ''))),
      'áàãâäéèêëíìîïóòõôöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc'
    ) AS value
  )
  SELECT CASE
    WHEN value LIKE '%departamento%pessoal%' OR value = 'dp' THEN 'departamento_pessoal'
    WHEN value LIKE '%contab%' THEN 'contabil'
    WHEN value LIKE '%fiscal%' THEN 'fiscal'
    WHEN value LIKE '%financ%' THEN 'financeiro'
    WHEN value LIKE '%comer%' THEN 'comercial'
    WHEN value LIKE '%societ%' THEN 'societario'
    WHEN value LIKE '%geral%' OR value = '' THEN 'geral'
    ELSE replace(value, ' ', '_')
  END
  FROM cleaned;
$$;

UPDATE public.kanban_tasks task
SET assigned_to_user_id = candidate.user_id
FROM (
  SELECT
    task_row.id AS task_id,
    min(profile.user_id::text)::uuid AS user_id
  FROM public.kanban_tasks task_row
  JOIN public.organization_user_access access
    ON access.organization_id = task_row.organization_id
   AND access.primary_role IN ('admin', 'colaborador')
  JOIN public.profiles profile
    ON profile.user_id = access.user_id
   AND lower(trim(profile.display_name)) = lower(trim(task_row.assignee))
  WHERE task_row.assigned_to_user_id IS NULL
    AND NULLIF(trim(task_row.assignee), '') IS NOT NULL
  GROUP BY task_row.id
  HAVING count(*) = 1
) candidate
WHERE task.id = candidate.task_id;

ALTER TABLE public.kanban_tasks
  DROP CONSTRAINT IF EXISTS kanban_tasks_fixed_sector_check;
ALTER TABLE public.kanban_tasks
  ADD CONSTRAINT kanban_tasks_fixed_sector_check
  CHECK (
    public.canonical_task_sector(sector) IN (
      'contabil',
      'fiscal',
      'departamento_pessoal',
      'financeiro',
      'comercial',
      'societario',
      'geral'
    )
  ) NOT VALID;

ALTER TABLE public.kanban_tasks
  VALIDATE CONSTRAINT kanban_tasks_fixed_sector_check;

REVOKE ALL ON FUNCTION public.canonical_task_sector(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.canonical_task_sector(text) TO authenticated;
