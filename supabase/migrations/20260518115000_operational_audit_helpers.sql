-- Operational audit helper and query indexes.

CREATE INDEX IF NOT EXISTS idx_operational_audit_logs_org_action_created_at
  ON public.operational_audit_logs (organization_id, action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_operational_audit_logs_org_result_created_at
  ON public.operational_audit_logs (organization_id, result, created_at DESC);

CREATE OR REPLACE FUNCTION public.record_operational_audit_log(
  _organization_id uuid,
  _action text,
  _entity_type text DEFAULT NULL,
  _entity_id uuid DEFAULT NULL,
  _client_id uuid DEFAULT NULL,
  _result text DEFAULT 'success',
  _metadata jsonb DEFAULT '{}'::jsonb,
  _request_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  inserted_id uuid;
BEGIN
  INSERT INTO public.operational_audit_logs (
    organization_id,
    actor_user_id,
    client_id,
    action,
    entity_type,
    entity_id,
    request_id,
    result,
    metadata
  )
  VALUES (
    _organization_id,
    auth.uid(),
    _client_id,
    _action,
    _entity_type,
    _entity_id,
    _request_id,
    COALESCE(NULLIF(_result, ''), 'success'),
    COALESCE(_metadata, '{}'::jsonb)
  )
  RETURNING id INTO inserted_id;

  RETURN inserted_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_operational_audit_log(
  uuid,
  text,
  text,
  uuid,
  uuid,
  text,
  jsonb,
  text
) TO authenticated;
