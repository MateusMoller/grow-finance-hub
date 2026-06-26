BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(18);

SELECT has_table('public', 'organization_user_access', 'canonical access table exists');
SELECT has_table('public', 'user_module_grants', 'module grant table exists');
SELECT has_table('public', 'permission_audit_entries', 'permission audit table exists');
SELECT has_column('public', 'organization_user_access', 'primary_role', 'primary role is stored');
SELECT has_column('public', 'organization_user_access', 'sector_code', 'sector is stored separately');
SELECT has_column('public', 'organization_user_access', 'requires_access_review', 'migration review flag exists');
SELECT has_column('public', 'user_module_grants', 'module_key', 'module grant key exists');
SELECT has_function(
  'public',
  'has_canonical_org_role',
  ARRAY['uuid', 'uuid', 'text'],
  'canonical role helper exists'
);
SELECT has_function(
  'public',
  'has_effective_module_access',
  ARRAY['uuid', 'uuid', 'text'],
  'module access helper exists'
);
SELECT has_function(
  'public',
  'get_my_effective_access',
  ARRAY['uuid'],
  'self effective-access helper exists'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'organization_user_access'
      AND c.relrowsecurity
  ),
  'access table has RLS'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'permission_audit_entries'
      AND c.relrowsecurity
  ),
  'audit table has RLS'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'user_module_grants'
      AND c.relrowsecurity
  ),
  'module grants have RLS'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'organization_user_access'
      AND policyname = 'Users read own access and canonical admins read organization access'
  ),
  'canonical self/Admin access policy exists'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_module_grants'
      AND policyname = 'Users read own grants and canonical admins read organization grants'
  ),
  'canonical self/Admin grants policy exists'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'permission_audit_entries'
      AND policyname = 'Admins read organization permission audit'
  ),
  'Admin-only permission audit read policy exists'
);
SELECT isnt_empty(
  $$SELECT 1 FROM information_schema.table_privileges WHERE table_schema = 'public' AND table_name = 'organization_user_access' AND grantee = 'authenticated' AND privilege_type = 'SELECT'$$,
  'authenticated has explicit read grant for access resolution'
);
SELECT isnt_empty(
  $$SELECT 1 FROM information_schema.table_privileges WHERE table_schema = 'public' AND table_name = 'permission_audit_entries' AND grantee = 'authenticated' AND privilege_type = 'SELECT'$$,
  'authenticated has explicit read grant guarded by audit RLS'
);

SELECT * FROM finish();

ROLLBACK;
