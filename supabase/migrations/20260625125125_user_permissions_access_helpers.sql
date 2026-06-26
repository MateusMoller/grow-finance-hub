CREATE OR REPLACE FUNCTION public.has_canonical_org_role(
  _user_id uuid,
  _organization_id uuid,
  _role text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_user_access access
    WHERE access.user_id = _user_id
      AND access.organization_id = _organization_id
      AND access.primary_role = _role
      AND access.status = 'active'
      AND NOT access.requires_access_review
  );
$$;

CREATE OR REPLACE FUNCTION public.is_canonical_internal_user(
  _user_id uuid,
  _organization_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_user_access access
    WHERE access.user_id = _user_id
      AND access.organization_id = _organization_id
      AND access.primary_role IN ('admin', 'colaborador')
      AND access.status = 'active'
      AND NOT access.requires_access_review
  );
$$;

CREATE OR REPLACE FUNCTION public.has_effective_module_access(
  _user_id uuid,
  _organization_id uuid,
  _module_key text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH canonical AS (
    SELECT access.primary_role, access.status, access.requires_access_review
    FROM public.organization_user_access access
    WHERE access.user_id = _user_id
      AND access.organization_id = _organization_id
  )
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM canonical
      WHERE primary_role = 'admin'
        AND status = 'active'
        AND NOT requires_access_review
    ) THEN true
    WHEN EXISTS (
      SELECT 1
      FROM canonical
      JOIN public.user_module_grants grant_row
        ON grant_row.user_id = _user_id
       AND grant_row.organization_id = _organization_id
       AND grant_row.module_key = _module_key
      WHERE canonical.primary_role = 'colaborador'
        AND canonical.status = 'active'
        AND NOT canonical.requires_access_review
    ) THEN true
    WHEN EXISTS (SELECT 1 FROM canonical) THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.user_roles legacy
      WHERE legacy.user_id = _user_id
        AND legacy.organization_id = _organization_id
        AND (
          legacy.role = 'admin'::public.app_role
          OR (
            legacy.role IN (
              'director'::public.app_role,
              'manager'::public.app_role,
              'employee'::public.app_role,
              'commercial'::public.app_role,
              'partner'::public.app_role
            )
            AND _module_key <> 'usuarios'
            AND _module_key <> 'financeiro'
          )
          OR (
            legacy.role IN (
              'departamento_pessoal'::public.app_role,
              'fiscal'::public.app_role,
              'contabil'::public.app_role
            )
            AND _module_key IN (
              'portal',
              'clientes',
              'calendario',
              'tarefas',
              'formularios',
              'relatorios',
              'obrigacoes',
              'acessorias',
              'sugestoes',
              'manual',
              'notificacoes'
            )
          )
        )
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_effective_access(_organization_id uuid)
RETURNS TABLE (
  organization_id uuid,
  user_id uuid,
  status text,
  primary_role text,
  sector_code text,
  enabled_modules text[],
  active_client_ids uuid[],
  requires_access_review boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    access.organization_id,
    access.user_id,
    access.status,
    access.primary_role,
    access.sector_code,
    CASE
      WHEN access.primary_role = 'admin' THEN ARRAY[
        'dashboard', 'portal', 'clientes', 'financeiro', 'obrigacoes', 'ia',
        'whatsapp', 'open_finance', 'acessorias', 'robo_documentos', 'crm',
        'chat_interno', 'calendario', 'tarefas', 'formularios', 'relatorios',
        'notificacoes', 'usuarios', 'newsletter', 'sugestoes', 'manual',
        'configuracoes'
      ]::text[]
      WHEN access.primary_role = 'colaborador' THEN COALESCE((
        SELECT array_agg(grant_row.module_key ORDER BY grant_row.module_key)
        FROM public.user_module_grants grant_row
        WHERE grant_row.organization_id = access.organization_id
          AND grant_row.user_id = access.user_id
      ), ARRAY[]::text[])
      ELSE ARRAY[]::text[]
    END AS enabled_modules,
    CASE
      WHEN access.primary_role = 'cliente' THEN COALESCE((
        SELECT array_agg(link.client_id ORDER BY link.client_id)
        FROM public.client_users link
        JOIN public.clients client ON client.id = link.client_id
        WHERE link.organization_id = access.organization_id
          AND link.user_id = access.user_id
          AND link.status = 'active'
          AND lower(COALESCE(client.status, 'ativo')) <> 'inativo'
      ), ARRAY[]::uuid[])
      ELSE ARRAY[]::uuid[]
    END AS active_client_ids,
    access.requires_access_review
  FROM public.organization_user_access access
  WHERE access.organization_id = _organization_id
    AND access.user_id = (SELECT auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.enforce_user_module_grant_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  access_record public.organization_user_access;
BEGIN
  SELECT *
  INTO access_record
  FROM public.organization_user_access
  WHERE organization_id = COALESCE(NEW.organization_id, OLD.organization_id)
    AND user_id = COALESCE(NEW.user_id, OLD.user_id);

  IF TG_OP <> 'DELETE' AND access_record.primary_role IS DISTINCT FROM 'colaborador' THEN
    RAISE EXCEPTION 'module_grants_require_colaborador';
  END IF;

  IF TG_OP = 'DELETE'
    AND OLD.module_key = 'tarefas'
    AND access_record.status = 'active' THEN
    RAISE EXCEPTION 'tasks_required_for_active_colaborador';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_required_collaborator_grants()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.primary_role = 'colaborador' AND NEW.status = 'active' THEN
    INSERT INTO public.user_module_grants (
      organization_id,
      user_id,
      module_key,
      granted_by,
      source
    )
    VALUES (
      NEW.organization_id,
      NEW.user_id,
      'tarefas',
      NEW.updated_by,
      'default'
    )
    ON CONFLICT (organization_id, user_id, module_key) DO NOTHING;
  ELSIF NEW.primary_role <> 'colaborador' THEN
    DELETE FROM public.user_module_grants
    WHERE organization_id = NEW.organization_id
      AND user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_last_active_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  active_admin_count integer;
  loses_admin boolean;
  target_organization_id uuid;
  target_user_id uuid;
BEGIN
  target_organization_id := COALESCE(NEW.organization_id, OLD.organization_id);
  target_user_id := COALESCE(NEW.user_id, OLD.user_id);
  loses_admin := OLD.primary_role = 'admin'
    AND OLD.status = 'active'
    AND (
      TG_OP = 'DELETE'
      OR NEW.primary_role <> 'admin'
      OR NEW.status <> 'active'
    );

  IF NOT loses_admin THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;

    RETURN NEW;
  END IF;

  SELECT count(*)
  INTO active_admin_count
  FROM public.organization_user_access
  WHERE organization_id = target_organization_id
    AND primary_role = 'admin'
    AND status = 'active'
    AND user_id <> target_user_id;

  IF active_admin_count = 0 THEN
    INSERT INTO public.permission_audit_entries (
      organization_id,
      actor_user_id,
      target_user_id,
      action,
      previous_value,
      new_value,
      result
    )
    VALUES (
      target_organization_id,
      (SELECT auth.uid()),
      target_user_id,
      'last_admin_change_denied',
      to_jsonb(OLD),
      CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
      'denied'
    );
    RAISE EXCEPTION 'last_admin_blocked';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_user_module_grant_owner
  BEFORE INSERT OR UPDATE OR DELETE ON public.user_module_grants
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_user_module_grant_owner();

CREATE TRIGGER sync_required_collaborator_grants
  AFTER INSERT OR UPDATE OF primary_role, status ON public.organization_user_access
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_required_collaborator_grants();

CREATE TRIGGER protect_last_active_admin
  BEFORE UPDATE OF primary_role, status OR DELETE ON public.organization_user_access
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_last_active_admin();

DROP POLICY IF EXISTS "Users read own access and legacy admins read organization access"
  ON public.organization_user_access;
CREATE POLICY "Users read own access and canonical admins read organization access"
  ON public.organization_user_access
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.has_canonical_org_role(
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

DROP POLICY IF EXISTS "Users read own grants and legacy admins read organization grants"
  ON public.user_module_grants;
CREATE POLICY "Users read own grants and canonical admins read organization grants"
  ON public.user_module_grants
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.has_canonical_org_role(
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

DROP POLICY IF EXISTS "Legacy admins read organization permission audit"
  ON public.permission_audit_entries;
CREATE POLICY "Admins read organization permission audit"
  ON public.permission_audit_entries
  FOR SELECT
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

REVOKE ALL ON FUNCTION public.has_canonical_org_role(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_canonical_internal_user(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_effective_module_access(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_effective_access(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.enforce_user_module_grant_owner() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_required_collaborator_grants() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_last_active_admin() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_canonical_org_role(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_canonical_internal_user(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_effective_module_access(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_effective_access(uuid) TO authenticated;
