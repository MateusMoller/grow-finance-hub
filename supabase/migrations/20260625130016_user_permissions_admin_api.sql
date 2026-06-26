CREATE OR REPLACE FUNCTION public.is_permission_admin(_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_canonical_org_role(
      (SELECT auth.uid()),
      _organization_id,
      'admin'
    )
    OR public.has_org_role(
      (SELECT auth.uid()),
      _organization_id,
      'admin'::public.app_role
    );
$$;

CREATE OR REPLACE FUNCTION public.admin_list_user_access(
  _organization_id uuid,
  _search text DEFAULT NULL,
  _role text DEFAULT NULL,
  _sector_code text DEFAULT NULL,
  _status text DEFAULT NULL,
  _module_key text DEFAULT NULL,
  _client_id uuid DEFAULT NULL,
  _requires_access_review boolean DEFAULT NULL,
  _page integer DEFAULT 1,
  _page_size integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  safe_page integer := greatest(COALESCE(_page, 1), 1);
  safe_page_size integer := least(greatest(COALESCE(_page_size, 50), 1), 100);
  result jsonb;
BEGIN
  IF NOT public.is_permission_admin(_organization_id) THEN
    RAISE EXCEPTION 'admin_required';
  END IF;

  WITH filtered AS (
    SELECT
      access.organization_id,
      access.user_id,
      auth_user.email,
      profile.display_name,
      access.primary_role,
      access.status,
      access.sector_code,
      access.requires_access_review,
      access.created_at,
      access.updated_at,
      COALESCE((
        SELECT jsonb_agg(grant_row.module_key ORDER BY grant_row.module_key)
        FROM public.user_module_grants grant_row
        WHERE grant_row.organization_id = access.organization_id
          AND grant_row.user_id = access.user_id
      ), '[]'::jsonb) AS enabled_modules,
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'client_id', link.client_id,
            'name', client.name,
            'status', link.status
          )
          ORDER BY client.name
        )
        FROM public.client_users link
        JOIN public.clients client ON client.id = link.client_id
        WHERE link.organization_id = access.organization_id
          AND link.user_id = access.user_id
          AND link.status = 'active'
      ), '[]'::jsonb) AS linked_clients
    FROM public.organization_user_access access
    JOIN auth.users auth_user ON auth_user.id = access.user_id
    LEFT JOIN public.profiles profile ON profile.user_id = access.user_id
    WHERE access.organization_id = _organization_id
      AND (
        NULLIF(trim(COALESCE(_search, '')), '') IS NULL
        OR COALESCE(profile.display_name, '') ILIKE '%' || trim(_search) || '%'
        OR COALESCE(auth_user.email, '') ILIKE '%' || trim(_search) || '%'
      )
      AND (NULLIF(_role, '') IS NULL OR access.primary_role = _role)
      AND (NULLIF(_sector_code, '') IS NULL OR access.sector_code = _sector_code)
      AND (NULLIF(_status, '') IS NULL OR access.status = _status)
      AND (
        _requires_access_review IS NULL
        OR access.requires_access_review = _requires_access_review
      )
      AND (
        NULLIF(_module_key, '') IS NULL
        OR access.primary_role = 'admin'
        OR EXISTS (
          SELECT 1
          FROM public.user_module_grants grant_filter
          WHERE grant_filter.organization_id = access.organization_id
            AND grant_filter.user_id = access.user_id
            AND grant_filter.module_key = _module_key
        )
      )
      AND (
        _client_id IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.client_users client_filter
          WHERE client_filter.organization_id = access.organization_id
            AND client_filter.user_id = access.user_id
            AND client_filter.client_id = _client_id
            AND client_filter.status = 'active'
        )
      )
  ),
  paged AS (
    SELECT *
    FROM filtered
    ORDER BY COALESCE(display_name, email), user_id
    OFFSET (safe_page - 1) * safe_page_size
    LIMIT safe_page_size
  )
  SELECT jsonb_build_object(
    'items',
    COALESCE((
      SELECT jsonb_agg(to_jsonb(paged) ORDER BY COALESCE(paged.display_name, paged.email))
      FROM paged
    ), '[]'::jsonb),
    'page', safe_page,
    'page_size', safe_page_size,
    'total', (SELECT count(*) FROM filtered)
  )
  INTO result;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_apply_user_access(
  _organization_id uuid,
  _target_user_id uuid,
  _display_name text,
  _primary_role text,
  _status text,
  _sector_code text DEFAULT NULL,
  _enabled_modules text[] DEFAULT ARRAY[]::text[],
  _linked_client_ids uuid[] DEFAULT ARRAY[]::uuid[],
  _change_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id uuid := (SELECT auth.uid());
  previous_access public.organization_user_access;
  next_access public.organization_user_access;
  normalized_modules text[];
  previous_modules text[] := ARRAY[]::text[];
  previous_clients uuid[] := ARRAY[]::uuid[];
  invalid_module text;
  invalid_client uuid;
  active_admin_count integer := 0;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;
  IF NOT public.is_permission_admin(_organization_id) THEN
    RAISE EXCEPTION 'admin_required';
  END IF;
  IF _primary_role NOT IN ('admin', 'colaborador', 'cliente') THEN
    RAISE EXCEPTION 'invalid_role';
  END IF;
  IF _status NOT IN ('pending', 'active', 'suspended', 'inactive') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;
  IF _primary_role = 'colaborador'
    AND _status = 'active'
    AND _sector_code IS NULL THEN
    RAISE EXCEPTION 'sector_required';
  END IF;
  IF _primary_role = 'colaborador'
    AND _sector_code NOT IN (
      'contabil',
      'fiscal',
      'departamento_pessoal',
      'financeiro',
      'comercial',
      'societario',
      'geral'
    ) THEN
    RAISE EXCEPTION 'invalid_sector';
  END IF;

  normalized_modules := CASE
    WHEN _primary_role = 'colaborador'
      THEN ARRAY(
        SELECT DISTINCT module_key
        FROM unnest(array_append(COALESCE(_enabled_modules, ARRAY[]::text[]), 'tarefas')) module_key
        ORDER BY module_key
      )
    ELSE ARRAY[]::text[]
  END;

  SELECT module_key
  INTO invalid_module
  FROM unnest(normalized_modules) module_key
  WHERE module_key NOT IN (
    'dashboard', 'portal', 'clientes', 'financeiro', 'obrigacoes', 'ia',
    'whatsapp', 'open_finance', 'acessorias', 'robo_documentos', 'crm',
    'chat_interno', 'calendario', 'tarefas', 'formularios', 'relatorios',
    'notificacoes', 'usuarios', 'newsletter', 'sugestoes', 'manual',
    'configuracoes'
  )
  LIMIT 1;
  IF invalid_module IS NOT NULL THEN
    RAISE EXCEPTION 'invalid_module';
  END IF;

  SELECT requested_client_id
  INTO invalid_client
  FROM unnest(COALESCE(_linked_client_ids, ARRAY[]::uuid[])) requested_client_id
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.clients client
    WHERE client.id = requested_client_id
      AND client.organization_id = _organization_id
  )
  LIMIT 1;
  IF invalid_client IS NOT NULL THEN
    RAISE EXCEPTION 'invalid_client_link';
  END IF;

  SELECT *
  INTO previous_access
  FROM public.organization_user_access
  WHERE organization_id = _organization_id
    AND user_id = _target_user_id
  FOR UPDATE;

  IF previous_access.id IS NOT NULL
    AND previous_access.primary_role = 'admin'
    AND previous_access.status = 'active'
    AND NOT (_primary_role = 'admin' AND _status = 'active') THEN
    SELECT count(*)
    INTO active_admin_count
    FROM public.organization_user_access
    WHERE organization_id = _organization_id
      AND primary_role = 'admin'
      AND status = 'active';

    IF active_admin_count <= 1 THEN
      INSERT INTO public.permission_audit_entries (
        organization_id,
        actor_user_id,
        target_user_id,
        action,
        previous_value,
        new_value,
        reason,
        result
      )
      VALUES (
        _organization_id,
        actor_id,
        _target_user_id,
        'last_admin_change_denied',
        to_jsonb(previous_access),
        jsonb_build_object(
          'primary_role', _primary_role,
          'status', _status,
          'sector_code', CASE WHEN _primary_role = 'colaborador' THEN _sector_code ELSE NULL END,
          'enabled_modules', normalized_modules,
          'linked_client_ids', CASE WHEN _primary_role = 'cliente' THEN COALESCE(_linked_client_ids, ARRAY[]::uuid[]) ELSE ARRAY[]::uuid[] END
        ),
        NULLIF(trim(COALESCE(_change_reason, '')), ''),
        'denied'
      );

      RETURN jsonb_build_object(
        'ok', false,
        'code', 'last_admin_blocked',
        'target_user_id', _target_user_id
      );
    END IF;
  END IF;

  SELECT COALESCE(array_agg(module_key ORDER BY module_key), ARRAY[]::text[])
  INTO previous_modules
  FROM public.user_module_grants
  WHERE organization_id = _organization_id
    AND user_id = _target_user_id;

  SELECT COALESCE(array_agg(client_id ORDER BY client_id), ARRAY[]::uuid[])
  INTO previous_clients
  FROM public.client_users
  WHERE organization_id = _organization_id
    AND user_id = _target_user_id
    AND status = 'active';

  INSERT INTO public.profiles (user_id, display_name)
  VALUES (_target_user_id, NULLIF(trim(_display_name), ''))
  ON CONFLICT (user_id) DO UPDATE
  SET display_name = EXCLUDED.display_name;

  INSERT INTO public.organization_user_access (
    organization_id,
    user_id,
    primary_role,
    status,
    sector_code,
    requires_access_review,
    created_by,
    updated_by
  )
  VALUES (
    _organization_id,
    _target_user_id,
    _primary_role,
    _status,
    CASE WHEN _primary_role = 'colaborador' THEN _sector_code ELSE NULL END,
    false,
    actor_id,
    actor_id
  )
  ON CONFLICT (organization_id, user_id) DO UPDATE
  SET
    primary_role = EXCLUDED.primary_role,
    status = EXCLUDED.status,
    sector_code = EXCLUDED.sector_code,
    requires_access_review = false,
    updated_by = actor_id,
    updated_at = now()
  RETURNING *
  INTO next_access;

  DELETE FROM public.user_module_grants
  WHERE organization_id = _organization_id
    AND user_id = _target_user_id
    AND (
      _primary_role <> 'colaborador'
      OR module_key <> ALL(normalized_modules)
    );

  IF _primary_role = 'colaborador' THEN
    INSERT INTO public.user_module_grants (
      organization_id,
      user_id,
      module_key,
      granted_by,
      source
    )
    SELECT
      _organization_id,
      _target_user_id,
      module_key,
      actor_id,
      'admin'
    FROM unnest(normalized_modules) module_key
    ON CONFLICT (organization_id, user_id, module_key) DO NOTHING;
  END IF;

  UPDATE public.client_users
  SET status = 'revoked', updated_at = now()
  WHERE organization_id = _organization_id
    AND user_id = _target_user_id
    AND (
      _primary_role <> 'cliente'
      OR client_id <> ALL(COALESCE(_linked_client_ids, ARRAY[]::uuid[]))
    );

  IF _primary_role = 'cliente' THEN
    INSERT INTO public.client_users (
      organization_id,
      client_id,
      user_id,
      role,
      status,
      created_by
    )
    SELECT
      _organization_id,
      client_id,
      _target_user_id,
      'owner',
      'active',
      actor_id
    FROM unnest(COALESCE(_linked_client_ids, ARRAY[]::uuid[])) client_id
    ON CONFLICT (client_id, user_id) DO UPDATE
    SET
      organization_id = EXCLUDED.organization_id,
      status = 'active',
      updated_at = now();
  END IF;

  INSERT INTO public.permission_audit_entries (
    organization_id,
    actor_user_id,
    target_user_id,
    action,
    previous_value,
    new_value,
    reason,
    result
  )
  VALUES (
    _organization_id,
    actor_id,
    _target_user_id,
    CASE WHEN previous_access.id IS NULL THEN 'user_created' ELSE 'access_updated' END,
    CASE WHEN previous_access.id IS NULL THEN NULL ELSE to_jsonb(previous_access) END,
    jsonb_build_object(
      'primary_role', next_access.primary_role,
      'status', next_access.status,
      'sector_code', next_access.sector_code,
      'enabled_modules', normalized_modules,
      'linked_client_ids', COALESCE(_linked_client_ids, ARRAY[]::uuid[])
    ),
    NULLIF(trim(COALESCE(_change_reason, '')), ''),
    'success'
  );

  IF previous_access.id IS NOT NULL THEN
    INSERT INTO public.permission_audit_entries (
      organization_id,
      actor_user_id,
      target_user_id,
      action,
      previous_value,
      new_value,
      reason,
      result
    )
    SELECT
      _organization_id,
      actor_id,
      _target_user_id,
      change.action,
      change.previous_value,
      change.new_value,
      NULLIF(trim(COALESCE(_change_reason, '')), ''),
      'success'
    FROM (
      SELECT
        'role_changed'::text AS action,
        to_jsonb(previous_access.primary_role) AS previous_value,
        to_jsonb(next_access.primary_role) AS new_value
      WHERE previous_access.primary_role IS DISTINCT FROM next_access.primary_role
      UNION ALL
      SELECT
        'status_changed',
        to_jsonb(previous_access.status),
        to_jsonb(next_access.status)
      WHERE previous_access.status IS DISTINCT FROM next_access.status
      UNION ALL
      SELECT
        'sector_changed',
        to_jsonb(previous_access.sector_code),
        to_jsonb(next_access.sector_code)
      WHERE previous_access.sector_code IS DISTINCT FROM next_access.sector_code
      UNION ALL
      SELECT
        'modules_changed',
        to_jsonb(previous_modules),
        to_jsonb(normalized_modules)
      WHERE previous_modules IS DISTINCT FROM normalized_modules
      UNION ALL
      SELECT
        'client_links_changed',
        to_jsonb(previous_clients),
        to_jsonb(
          CASE
            WHEN next_access.primary_role = 'cliente'
              THEN COALESCE(_linked_client_ids, ARRAY[]::uuid[])
            ELSE ARRAY[]::uuid[]
          END
        )
      WHERE previous_clients IS DISTINCT FROM (
        CASE
          WHEN next_access.primary_role = 'cliente'
            THEN COALESCE(_linked_client_ids, ARRAY[]::uuid[])
          ELSE ARRAY[]::uuid[]
        END
      )
    ) change;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'target_user_id', _target_user_id,
    'effective_access', jsonb_build_object(
      'primary_role', next_access.primary_role,
      'status', next_access.status,
      'sector_code', next_access.sector_code,
      'enabled_modules', CASE
        WHEN next_access.primary_role = 'admin' THEN '["*"]'::jsonb
        ELSE to_jsonb(normalized_modules)
      END,
      'active_client_ids', CASE
        WHEN next_access.primary_role = 'cliente'
          THEN to_jsonb(COALESCE(_linked_client_ids, ARRAY[]::uuid[]))
        ELSE '[]'::jsonb
      END
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_permission_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_user_access(
  uuid, text, text, text, text, text, uuid, boolean, integer, integer
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_apply_user_access(
  uuid, uuid, text, text, text, text, text[], uuid[], text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_permission_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_user_access(
  uuid, text, text, text, text, text, uuid, boolean, integer, integer
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_apply_user_access(
  uuid, uuid, text, text, text, text, text[], uuid[], text
) TO authenticated;
