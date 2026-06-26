CREATE OR REPLACE FUNCTION public.admin_list_permission_audit(
  _organization_id uuid,
  _target_user_id uuid DEFAULT NULL,
  _actor_user_id uuid DEFAULT NULL,
  _action text DEFAULT NULL,
  _date_from date DEFAULT NULL,
  _date_to date DEFAULT NULL,
  _page integer DEFAULT 1,
  _page_size integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
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
      audit.id,
      audit.organization_id,
      audit.actor_user_id,
      actor_profile.display_name AS actor_name,
      audit.target_user_id,
      target_profile.display_name AS target_name,
      audit.action,
      audit.previous_value,
      audit.new_value,
      audit.reason,
      audit.result,
      audit.created_at
    FROM public.permission_audit_entries audit
    LEFT JOIN public.profiles actor_profile ON actor_profile.user_id = audit.actor_user_id
    LEFT JOIN public.profiles target_profile ON target_profile.user_id = audit.target_user_id
    WHERE audit.organization_id = _organization_id
      AND (_target_user_id IS NULL OR audit.target_user_id = _target_user_id)
      AND (_actor_user_id IS NULL OR audit.actor_user_id = _actor_user_id)
      AND (NULLIF(_action, '') IS NULL OR audit.action = _action)
      AND (_date_from IS NULL OR audit.created_at >= _date_from::timestamptz)
      AND (_date_to IS NULL OR audit.created_at < (_date_to + 1)::timestamptz)
  ),
  paged AS (
    SELECT *
    FROM filtered
    ORDER BY created_at DESC, id DESC
    OFFSET (safe_page - 1) * safe_page_size
    LIMIT safe_page_size
  )
  SELECT jsonb_build_object(
    'items', COALESCE((SELECT jsonb_agg(to_jsonb(paged) ORDER BY created_at DESC) FROM paged), '[]'::jsonb),
    'page', safe_page,
    'page_size', safe_page_size,
    'total', (SELECT count(*) FROM filtered)
  )
  INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_permission_audit(
  uuid, uuid, uuid, text, date, date, integer, integer
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_permission_audit(
  uuid, uuid, uuid, text, date, date, integer, integer
) TO authenticated;
