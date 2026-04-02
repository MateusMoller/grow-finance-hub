-- WARNING:
-- This migration was requested to:
-- 1) allow all auth users to access the client portal
-- 2) set the same default password for all active users
-- Review security implications before running in production.

DO $$
DECLARE
  v_default_password text := '123456';
BEGIN
  -- Ensure all active users have the "client" role (in addition to existing roles).
  INSERT INTO public.user_roles (user_id, role)
  SELECT
    u.id,
    'client'::public.app_role
  FROM auth.users u
  WHERE u.deleted_at IS NULL
    AND u.email IS NOT NULL
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Link existing client records by e-mail where possible and where no portal user is assigned yet.
  WITH user_email AS (
    SELECT
      u.id AS user_id,
      lower(trim(u.email)) AS email
    FROM auth.users u
    WHERE u.deleted_at IS NULL
      AND u.email IS NOT NULL
  ),
  candidate_clients AS (
    SELECT
      ue.user_id,
      c.id AS client_id,
      row_number() OVER (
        PARTITION BY ue.user_id
        ORDER BY c.created_at NULLS LAST, c.id
      ) AS rn
    FROM user_email ue
    JOIN public.clients c
      ON lower(trim(coalesce(c.email, ''))) = ue.email
    WHERE c.portal_user_id IS NULL
  ),
  first_match AS (
    SELECT
      cc.user_id,
      cc.client_id
    FROM candidate_clients cc
    WHERE cc.rn = 1
  )
  UPDATE public.clients c
  SET
    portal_user_id = fm.user_id,
    updated_at = now()
  FROM first_match fm
  WHERE c.id = fm.client_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.clients c2
      WHERE c2.portal_user_id = fm.user_id
    );

  -- Create missing client records for users that still do not have any portal link.
  INSERT INTO public.clients (
    name,
    contact,
    email,
    regime,
    sector,
    status,
    portal_user_id
  )
  SELECT
    coalesce(nullif(trim(p.display_name), ''), split_part(u.email, '@', 1)),
    coalesce(nullif(trim(p.display_name), ''), split_part(u.email, '@', 1)),
    lower(trim(u.email)),
    'Simples Nacional',
    'Servicos',
    'Ativo',
    u.id
  FROM auth.users u
  LEFT JOIN public.profiles p
    ON p.user_id = u.id
  WHERE u.deleted_at IS NULL
    AND u.email IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.clients c
      WHERE c.portal_user_id = u.id
    );

  -- Set one shared default password for all active users (as requested).
  UPDATE auth.users u
  SET
    encrypted_password = extensions.crypt(v_default_password, extensions.gen_salt('bf')),
    email_confirmed_at = coalesce(u.email_confirmed_at, now()),
    updated_at = now()
  WHERE u.deleted_at IS NULL
    AND u.email IS NOT NULL;
END;
$$;
