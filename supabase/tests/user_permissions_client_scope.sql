BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(9);

SELECT has_table('public', 'client_users', 'client links table exists');
SELECT has_column('public', 'client_users', 'status', 'client links have lifecycle status');
SELECT has_index('public', 'client_users', 'client_users_client_user_key', 'one link per client/user exists');
SELECT has_index('public', 'client_users', 'idx_client_users_active_user', 'active multi-client lookup index exists');
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'client_users'
      AND c.relrowsecurity
  ),
  'client links have RLS'
);
SELECT has_function(
  'public',
  'can_access_client',
  ARRAY['uuid', 'uuid'],
  'client access helper exists'
);
SELECT has_function(
  'public',
  'get_my_effective_access',
  ARRAY['uuid'],
  'effective access returns linked client scope'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'client_users'
      AND indexname = 'idx_client_users_active_user'
      AND indexdef ILIKE '%status%'
      AND indexdef ILIKE '%client_id%'
  ),
  'active client lookup index includes status and client scope'
);
SELECT ok(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'portal_user_id'),
  'legacy portal_user_id remains compatibility-only data'
);

SELECT * FROM finish();
ROLLBACK;
