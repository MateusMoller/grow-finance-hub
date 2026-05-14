CREATE OR REPLACE FUNCTION public.upsert_client_cashflow_consultive_alert(
  _client_id uuid,
  _source_key text,
  _severity text,
  _title text,
  _message text,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  alert_id uuid;
  cashflow_enabled boolean := false;
BEGIN
  SELECT coalesce(c.portal_cashflow_enabled, false)
  INTO cashflow_enabled
  FROM public.clients c
  WHERE c.id = _client_id;

  IF NOT cashflow_enabled THEN
    DELETE FROM public.client_cashflow_consultive_alerts
    WHERE client_id = _client_id
      AND source_type = 'cashflow_consultive';

    RETURN null;
  END IF;

  INSERT INTO public.client_cashflow_consultive_alerts (
    client_id,
    source_type,
    source_key,
    severity,
    title,
    message,
    status,
    metadata,
    resolved_at
  )
  VALUES (
    _client_id,
    'cashflow_consultive',
    _source_key,
    coalesce(_severity, 'info'),
    _title,
    _message,
    'active',
    coalesce(_metadata, '{}'::jsonb),
    null
  )
  ON CONFLICT (client_id, source_type, source_key)
  DO UPDATE SET
    severity = EXCLUDED.severity,
    title = EXCLUDED.title,
    message = EXCLUDED.message,
    status = 'active',
    metadata = EXCLUDED.metadata,
    resolved_at = null,
    updated_at = now()
  RETURNING id INTO alert_id;

  RETURN alert_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_cashflow_consultive_task(
  _client_id uuid,
  _integration_task_id text,
  _title text,
  _description text,
  _priority text,
  _due_date date,
  _payload jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  client_name_value text;
  cashflow_enabled boolean := false;
BEGIN
  SELECT
    c.name,
    coalesce(c.portal_cashflow_enabled, false)
  INTO
    client_name_value,
    cashflow_enabled
  FROM public.clients c
  WHERE c.id = _client_id;

  IF client_name_value IS NULL OR NOT cashflow_enabled THEN
    DELETE FROM public.kanban_tasks
    WHERE integration_source = 'cashflow_consultive'
      AND integration_task_id = _integration_task_id;

    RETURN;
  END IF;

  INSERT INTO public.kanban_tasks (
    title,
    description,
    client_name,
    assignee,
    priority,
    sector,
    status,
    due_date,
    tags,
    created_by,
    integration_source,
    integration_task_id,
    integration_payload
  )
  VALUES (
    _title,
    _description,
    client_name_value,
    null,
    coalesce(_priority, 'high'),
    'Financeiro',
    'backlog',
    _due_date,
    ARRAY['Financeiro', 'Caixa consultivo'],
    null,
    'cashflow_consultive',
    _integration_task_id,
    coalesce(_payload, '{}'::jsonb)
  )
  ON CONFLICT (integration_source, integration_task_id)
  DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    client_name = EXCLUDED.client_name,
    priority = EXCLUDED.priority,
    sector = EXCLUDED.sector,
    due_date = EXCLUDED.due_date,
    tags = EXCLUDED.tags,
    integration_payload = EXCLUDED.integration_payload,
    status = CASE
      WHEN public.kanban_tasks.status = 'done' THEN 'backlog'
      ELSE public.kanban_tasks.status
    END,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_client_cashflow_access_toggle()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF coalesce(NEW.portal_cashflow_enabled, false) = false THEN
    DELETE FROM public.kanban_tasks
    WHERE integration_source = 'cashflow_consultive'
      AND integration_task_id LIKE NEW.id::text || ':%';

    DELETE FROM public.client_cashflow_consultive_alerts
    WHERE client_id = NEW.id
      AND source_type = 'cashflow_consultive';

    DELETE FROM public.client_cashflow_health_snapshots
    WHERE client_id = NEW.id;

    RETURN NEW;
  END IF;

  IF coalesce(OLD.portal_cashflow_enabled, false) = false
    AND coalesce(NEW.portal_cashflow_enabled, false) = true THEN
    PERFORM public.refresh_client_cashflow_consultive_state(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS zz_handle_client_cashflow_access_toggle ON public.clients;
CREATE TRIGGER zz_handle_client_cashflow_access_toggle
  AFTER UPDATE OF portal_cashflow_enabled ON public.clients
  FOR EACH ROW
  WHEN (OLD.portal_cashflow_enabled IS DISTINCT FROM NEW.portal_cashflow_enabled)
  EXECUTE FUNCTION public.handle_client_cashflow_access_toggle();

DELETE FROM public.kanban_tasks kt
WHERE kt.integration_source = 'cashflow_consultive'
  AND NOT EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE kt.integration_task_id LIKE c.id::text || ':%'
      AND coalesce(c.portal_cashflow_enabled, false) = true
  );

DELETE FROM public.client_cashflow_consultive_alerts a
WHERE a.source_type = 'cashflow_consultive'
  AND NOT EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = a.client_id
      AND coalesce(c.portal_cashflow_enabled, false) = true
  );

DELETE FROM public.client_cashflow_health_snapshots s
WHERE NOT EXISTS (
  SELECT 1
  FROM public.clients c
  WHERE c.id = s.client_id
    AND coalesce(c.portal_cashflow_enabled, false) = true
);
