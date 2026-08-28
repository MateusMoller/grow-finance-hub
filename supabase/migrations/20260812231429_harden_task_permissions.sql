-- Canonical task authorization foundation.
-- Rollback must never restore PUBLIC helper execution, global grants, or legacy DELETE policies.

ALTER TABLE public.kanban_tasks
  ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_kanban_tasks_active_scope
  ON public.kanban_tasks (organization_id, status, sector, due_date)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_kanban_tasks_deleted_retention
  ON public.kanban_tasks (organization_id, deleted_at)
  WHERE deleted_at IS NOT NULL;

DROP POLICY IF EXISTS "Authenticated can delete own tasks" ON public.kanban_tasks;
DROP POLICY IF EXISTS "Tenant managers can delete kanban tasks by sector" ON public.kanban_tasks;
DROP POLICY IF EXISTS "Tenant admins can delete kanban tasks" ON public.kanban_tasks;
DROP POLICY IF EXISTS "Tenant admins delete canonical tasks" ON public.kanban_tasks;

REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.kanban_tasks FROM PUBLIC, anon, authenticated;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.kanban_task_comments FROM PUBLIC, anon, authenticated;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.kanban_task_relations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_access_task_sector(uuid, uuid, text) FROM PUBLIC, anon, authenticated;

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
    (_user_id = (SELECT auth.uid()) OR (SELECT auth.jwt()->>'role') = 'service_role')
    AND EXISTS (
      SELECT 1
      FROM public.organization_user_access access
      WHERE access.organization_id = _organization_id
        AND access.user_id = _user_id
        AND access.status = 'active'
        AND NOT access.requires_access_review
        AND (
          access.primary_role = 'admin'
          OR (
            access.primary_role = 'colaborador'
            AND access.sector_code = public.canonical_task_sector(_sector)
            AND EXISTS (
              SELECT 1
              FROM public.user_module_grants module_grant
              WHERE module_grant.organization_id = access.organization_id
                AND module_grant.user_id = access.user_id
                AND module_grant.module_key = 'tarefas'
            )
          )
        )
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
  SELECT
    (_user_id = (SELECT auth.uid()) OR (SELECT auth.jwt()->>'role') = 'service_role')
    AND EXISTS (
      SELECT 1
      FROM public.kanban_tasks task
      WHERE task.id = _task_id
        AND task.organization_id = _organization_id
        AND task.deleted_at IS NULL
        AND public.can_access_task_values(_user_id, task.organization_id, task.sector, task.assigned_to_user_id)
    );
$$;

REVOKE ALL ON FUNCTION public.can_access_task_values(uuid, uuid, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_kanban_task(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_task_values(uuid, uuid, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_kanban_task(uuid, uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Tenant users view canonical task scope" ON public.kanban_tasks;
CREATE POLICY "Tenant users view canonical task scope"
  ON public.kanban_tasks FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.can_access_task_values((SELECT auth.uid()), organization_id, sector, assigned_to_user_id)
  );

DROP POLICY IF EXISTS "Tenant users view comments for accessible tasks" ON public.kanban_task_comments;
CREATE POLICY "Tenant users view comments for accessible tasks"
  ON public.kanban_task_comments FOR SELECT TO authenticated
  USING (public.can_access_kanban_task((SELECT auth.uid()), organization_id, task_id));

DROP POLICY IF EXISTS "Tenant users view related accessible tasks" ON public.kanban_task_relations;
CREATE POLICY "Tenant users view related accessible tasks"
  ON public.kanban_task_relations FOR SELECT TO authenticated
  USING (
    public.can_access_kanban_task((SELECT auth.uid()), organization_id, source_task_id)
    AND public.can_access_kanban_task((SELECT auth.uid()), organization_id, target_task_id)
  );

CREATE OR REPLACE FUNCTION public.authorize_task_action(
  _actor_user_id uuid,
  _organization_id uuid,
  _task_id uuid,
  _action text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  access_row public.organization_user_access%ROWTYPE;
  task_row public.kanban_tasks%ROWTYPE;
  is_admin boolean := false;
  same_sector boolean := false;
  has_tasks_module boolean := false;
  allowed boolean := false;
BEGIN
  IF COALESCE((SELECT auth.jwt()->>'role'), '') <> 'service_role' THEN
    RETURN jsonb_build_object('allowed', false, 'code', 'action_not_allowed');
  END IF;

  SELECT * INTO access_row
  FROM public.organization_user_access
  WHERE organization_id = _organization_id AND user_id = _actor_user_id;

  IF NOT FOUND OR access_row.status <> 'active' OR access_row.requires_access_review THEN
    RETURN jsonb_build_object('allowed', false, 'code', 'task_not_available');
  END IF;

  is_admin := access_row.primary_role = 'admin';
  SELECT EXISTS (
    SELECT 1 FROM public.user_module_grants
    WHERE organization_id = _organization_id AND user_id = _actor_user_id AND module_key = 'tarefas'
  ) INTO has_tasks_module;

  IF _action = 'task.create' THEN
    allowed := is_admin OR (access_row.primary_role = 'colaborador' AND has_tasks_module);
    RETURN jsonb_build_object('allowed', allowed, 'code', CASE WHEN allowed THEN 'allowed' ELSE 'action_not_allowed' END);
  END IF;

  SELECT * INTO task_row FROM public.kanban_tasks
  WHERE id = _task_id AND organization_id = _organization_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'code', 'task_not_available');
  END IF;

  same_sector := access_row.sector_code = public.canonical_task_sector(task_row.sector);
  IF task_row.deleted_at IS NOT NULL THEN
    allowed := is_admin AND _action = 'task.restore';
  ELSIF is_admin THEN
    allowed := _action = ANY (ARRAY[
      'task.update_content','task.change_status','task.assign','task.change_sector',
      'task.change_client','task.manage_subtasks','task.archive','task.delete'
    ]);
  ELSE
    allowed := access_row.primary_role = 'colaborador' AND has_tasks_module AND same_sector
      AND _action = ANY (ARRAY['task.update_content','task.change_status','task.manage_subtasks']);
  END IF;

  RETURN jsonb_build_object('allowed', allowed, 'code', CASE WHEN allowed THEN 'allowed' ELSE 'action_not_allowed' END);
END;
$$;

REVOKE ALL ON FUNCTION public.authorize_task_action(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.authorize_task_action(uuid, uuid, uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.mutate_tasks_canonical(
  _actor_user_id uuid,
  _organization_id uuid,
  _action text,
  _items jsonb,
  _actor_source text,
  _correlation_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item jsonb;
  task_row public.kanban_tasks%ROWTYPE;
  decision jsonb;
  result_tasks jsonb := '[]'::jsonb;
  item_count integer;
  expected_version bigint;
  changes jsonb;
  changed_fields text[];
  audit_id uuid;
  before_task jsonb;
BEGIN
  IF COALESCE((SELECT auth.jwt()->>'role'), '') <> 'service_role' THEN
    RAISE EXCEPTION 'task_action_not_allowed' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(_items) <> 'array' THEN RAISE EXCEPTION 'invalid_task_items'; END IF;
  item_count := jsonb_array_length(_items);
  IF item_count < 1 OR item_count > 100 THEN RAISE EXCEPTION 'task_batch_limit'; END IF;

  -- Validate and lock every row before the first mutation.
  FOR item IN SELECT value FROM jsonb_array_elements(_items) LOOP
    IF _action = 'task.create' THEN
      decision := public.authorize_task_action(_actor_user_id, _organization_id, NULL, _action);
    ELSE
      SELECT * INTO task_row FROM public.kanban_tasks
      WHERE id = (item->>'taskId')::uuid AND organization_id = _organization_id
      FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'task_not_available' USING ERRCODE = 'P0002'; END IF;
      expected_version := NULLIF(item->>'expectedVersion', '')::bigint;
      IF expected_version IS NULL OR expected_version <> task_row.version THEN
        RAISE EXCEPTION 'task_version_conflict' USING ERRCODE = '40001';
      END IF;
      decision := public.authorize_task_action(_actor_user_id, _organization_id, task_row.id, _action);
    END IF;
    IF COALESCE((decision->>'allowed')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'task_not_available' USING ERRCODE = '42501';
    END IF;
  END LOOP;

  FOR item IN SELECT value FROM jsonb_array_elements(_items) LOOP
    changes := COALESCE(item->'changes', '{}'::jsonb);
    IF _action = 'task.create' THEN
      IF NULLIF(trim(changes->>'title'), '') IS NULL OR NULLIF(trim(changes->>'sector'), '') IS NULL THEN
        RAISE EXCEPTION 'invalid_task_create_payload';
      END IF;
      INSERT INTO public.kanban_tasks (
        organization_id, title, description, client_name, assignee, assigned_to_user_id,
        priority, sector, status, due_date, tags, subtasks, created_by
      ) VALUES (
        _organization_id, trim(changes->>'title'), NULLIF(changes->>'description',''),
        NULLIF(changes->>'client_name',''), NULLIF(changes->>'assignee',''),
        NULLIF(changes->>'assigned_to_user_id','')::uuid, COALESCE(NULLIF(changes->>'priority',''),'Média'),
        trim(changes->>'sector'), COALESCE(NULLIF(changes->>'status',''),'backlog'),
        NULLIF(changes->>'due_date','')::date,
        CASE WHEN jsonb_typeof(changes->'tags') = 'array' THEN ARRAY(SELECT jsonb_array_elements_text(changes->'tags')) ELSE '{}'::text[] END,
        COALESCE(changes->'subtasks','[]'::jsonb), _actor_user_id
      ) RETURNING * INTO task_row;
    ELSE
      SELECT * INTO task_row FROM public.kanban_tasks
      WHERE id = (item->>'taskId')::uuid AND organization_id = _organization_id FOR UPDATE;
      before_task := to_jsonb(task_row);

      IF _action = 'task.update_content' THEN
        IF changes - ARRAY['title','description','priority','due_date','tags'] <> '{}'::jsonb THEN RAISE EXCEPTION 'task_field_not_allowed'; END IF;
        UPDATE public.kanban_tasks SET
          title = COALESCE(NULLIF(trim(changes->>'title'),''), title),
          description = CASE WHEN changes ? 'description' THEN NULLIF(changes->>'description','') ELSE description END,
          priority = COALESCE(NULLIF(changes->>'priority',''), priority),
          due_date = CASE WHEN changes ? 'due_date' THEN NULLIF(changes->>'due_date','')::date ELSE due_date END,
          tags = CASE WHEN changes ? 'tags' THEN ARRAY(SELECT jsonb_array_elements_text(changes->'tags')) ELSE tags END,
          version = version + 1
        WHERE id = task_row.id RETURNING * INTO task_row;
      ELSIF _action = 'task.change_status' OR _action = 'task.archive' THEN
        IF changes - ARRAY['status'] <> '{}'::jsonb THEN RAISE EXCEPTION 'task_field_not_allowed'; END IF;
        UPDATE public.kanban_tasks SET status = changes->>'status', version = version + 1
        WHERE id = task_row.id RETURNING * INTO task_row;
      ELSIF _action = 'task.assign' THEN
        IF changes - ARRAY['assigned_to_user_id','assignee'] <> '{}'::jsonb THEN RAISE EXCEPTION 'task_field_not_allowed'; END IF;
        UPDATE public.kanban_tasks SET assigned_to_user_id = NULLIF(changes->>'assigned_to_user_id','')::uuid,
          assignee = NULLIF(changes->>'assignee',''), version = version + 1
        WHERE id = task_row.id RETURNING * INTO task_row;
      ELSIF _action = 'task.change_sector' THEN
        IF changes - ARRAY['sector'] <> '{}'::jsonb THEN RAISE EXCEPTION 'task_field_not_allowed'; END IF;
        UPDATE public.kanban_tasks SET sector = changes->>'sector', version = version + 1
        WHERE id = task_row.id RETURNING * INTO task_row;
      ELSIF _action = 'task.change_client' THEN
        IF changes - ARRAY['client_name'] <> '{}'::jsonb THEN RAISE EXCEPTION 'task_field_not_allowed'; END IF;
        UPDATE public.kanban_tasks SET client_name = NULLIF(changes->>'client_name',''), version = version + 1
        WHERE id = task_row.id RETURNING * INTO task_row;
      ELSIF _action = 'task.manage_subtasks' THEN
        IF changes - ARRAY['subtasks'] <> '{}'::jsonb THEN RAISE EXCEPTION 'task_field_not_allowed'; END IF;
        UPDATE public.kanban_tasks SET subtasks = COALESCE(changes->'subtasks','[]'::jsonb), version = version + 1
        WHERE id = task_row.id RETURNING * INTO task_row;
      ELSIF _action = 'task.delete' THEN
        UPDATE public.kanban_tasks SET deleted_at = now(), deleted_by = _actor_user_id, version = version + 1
        WHERE id = task_row.id RETURNING * INTO task_row;
      ELSIF _action = 'task.restore' THEN
        IF task_row.deleted_at < now() - interval '1 year' THEN RAISE EXCEPTION 'task_retention_expired'; END IF;
        UPDATE public.kanban_tasks SET deleted_at = NULL, deleted_by = NULL, version = version + 1
        WHERE id = task_row.id RETURNING * INTO task_row;
      ELSE
        RAISE EXCEPTION 'task_action_not_supported';
      END IF;
    END IF;

    changed_fields := ARRAY(SELECT jsonb_object_keys(changes));
    INSERT INTO public.operational_audit_logs (
      organization_id, actor_user_id, action, entity_type, entity_id, request_id, result, metadata
    ) VALUES (
      _organization_id, _actor_user_id, _action, 'task', task_row.id, _correlation_id, 'success',
      jsonb_build_object('actor_kind','human','actor_source',_actor_source,'before',before_task,'after',to_jsonb(task_row),'changed_fields',changed_fields)
    ) RETURNING id INTO audit_id;
    result_tasks := result_tasks || jsonb_build_array(to_jsonb(task_row));
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'tasks', result_tasks, 'auditId', audit_id, 'correlationId', _correlation_id);
END;
$$;

REVOKE ALL ON FUNCTION public.mutate_tasks_canonical(uuid, uuid, text, jsonb, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mutate_tasks_canonical(uuid, uuid, text, jsonb, text, text) TO service_role;

COMMENT ON FUNCTION public.mutate_tasks_canonical(uuid, uuid, text, jsonb, text, text)
  IS 'Service-role-only canonical human task mutation. Edge Function must authenticate the delegated actor.';
