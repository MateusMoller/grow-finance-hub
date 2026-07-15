DROP FUNCTION IF EXISTS public.list_task_assignees(uuid);

CREATE OR REPLACE FUNCTION public.list_task_assignees(_organization_id uuid)
RETURNS TABLE (
  user_id uuid,
  display_name text,
  sector_code text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH legacy_sectors AS (
    SELECT
      roles.user_id,
      CASE
        WHEN bool_or(roles.role = 'contabil'::public.app_role) THEN 'contabil'
        WHEN bool_or(roles.role = 'fiscal'::public.app_role) THEN 'fiscal'
        WHEN bool_or(roles.role = 'departamento_pessoal'::public.app_role) THEN 'departamento_pessoal'
        WHEN bool_or(roles.role = 'commercial'::public.app_role) THEN 'comercial'
        WHEN bool_or(roles.role = 'employee'::public.app_role) THEN 'geral'
        ELSE NULL
      END AS sector_code
    FROM public.user_roles AS roles
    WHERE roles.organization_id = _organization_id
    GROUP BY roles.user_id
  )
  SELECT
    access.user_id,
    COALESCE(
      NULLIF(trim(profile.display_name), ''),
      auth_user.email,
      access.user_id::text
    ) AS display_name,
    COALESCE(access.sector_code, legacy_sectors.sector_code) AS sector_code
  FROM public.organization_user_access AS access
  LEFT JOIN legacy_sectors
    ON legacy_sectors.user_id = access.user_id
  LEFT JOIN public.profiles AS profile
    ON profile.user_id = access.user_id
  LEFT JOIN auth.users AS auth_user
    ON auth_user.id = access.user_id
  WHERE access.organization_id = _organization_id
    AND access.primary_role = 'colaborador'
    AND access.status = 'active'
    AND NOT access.requires_access_review
    AND (
      public.has_canonical_org_role((SELECT auth.uid()), _organization_id, 'admin')
      OR public.has_org_role((SELECT auth.uid()), _organization_id, 'admin'::public.app_role)
      OR
      public.has_effective_module_access(
        (SELECT auth.uid()),
        _organization_id,
        'tarefas'
      )
      OR (
        NOT EXISTS (
          SELECT 1
          FROM public.organization_user_access AS caller_access
          WHERE caller_access.organization_id = _organization_id
            AND caller_access.user_id = (SELECT auth.uid())
        )
        AND public.is_internal_user((SELECT auth.uid()), _organization_id)
      )
    )
  ORDER BY COALESCE(NULLIF(trim(profile.display_name), ''), auth_user.email, access.user_id::text);
$$;

REVOKE ALL ON FUNCTION public.list_task_assignees(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_task_assignees(uuid) TO authenticated;
