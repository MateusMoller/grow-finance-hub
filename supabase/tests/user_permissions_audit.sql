BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(12);

SELECT has_table('public', 'permission_audit_entries', 'permission audit table exists');
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'permission_audit_entries'
      AND c.relrowsecurity
  ),
  'permission audit has RLS'
);
SELECT has_function(
  'public',
  'admin_list_permission_audit',
  ARRAY['uuid', 'uuid', 'uuid', 'text', 'date', 'date', 'integer', 'integer'],
  'Admin audit query exists'
);
SELECT has_index('public', 'permission_audit_entries', 'idx_permission_audit_org_created', 'organization chronology index exists');
SELECT has_index('public', 'permission_audit_entries', 'idx_permission_audit_target_created', 'target chronology index exists');
SELECT has_index('public', 'permission_audit_entries', 'idx_permission_audit_actor_created', 'actor chronology index exists');
SELECT has_index('public', 'permission_audit_entries', 'idx_permission_audit_action_created', 'action chronology index exists');
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'permission_audit_entries'
      AND policyname = 'Admins read organization permission audit'
  ),
  'Admin-only audit read policy exists'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'permission_audit_entries'
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  ),
  'audit table has no direct write policies for clients'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public'
      AND routine_name = 'admin_apply_user_access'
  ),
  'Admin mutation RPC is the audit write boundary'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'admin_apply_user_access'
      AND pg_get_functiondef(oid) ILIKE '%last_admin_change_denied%'
  ),
  'final Admin denial audit is emitted by canonical mutation RPC'
);
SELECT col_not_null('public', 'permission_audit_entries', 'result', 'audit result is mandatory');

SELECT * FROM finish();
ROLLBACK;
