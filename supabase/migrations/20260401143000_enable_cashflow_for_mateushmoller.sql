-- Enable cashflow module for mateushmoller@gmail.com
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id
  INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower('mateushmoller@gmail.com')
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    UPDATE public.clients
    SET
      portal_user_id = COALESCE(portal_user_id, v_user_id),
      portal_cashflow_enabled = true,
      updated_at = now()
    WHERE lower(COALESCE(email, '')) = lower('mateushmoller@gmail.com')
      OR portal_user_id = v_user_id;
  ELSE
    UPDATE public.clients
    SET
      portal_cashflow_enabled = true,
      updated_at = now()
    WHERE lower(COALESCE(email, '')) = lower('mateushmoller@gmail.com');
  END IF;
END
$$;
