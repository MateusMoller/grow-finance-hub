BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(16);

SELECT has_column('public', 'kanban_tasks', 'assigned_to_user_id', 'typed assignee exists');
SELECT has_function('public', 'canonical_task_sector', ARRAY['text'], 'sector normalizer exists');
SELECT has_function(
  'public',
  'can_access_task_values',
  ARRAY['uuid', 'uuid', 'text', 'uuid'],
  'sector or direct assignment helper exists'
);
SELECT has_function(
  'public',
  'can_access_kanban_task',
  ARRAY['uuid', 'uuid', 'uuid'],
  'task access helper exists'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'kanban_tasks'
      AND c.relrowsecurity
  ),
  'kanban tasks have RLS'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'kanban_task_comments'
      AND c.relrowsecurity
  ),
  'task comments have RLS'
);
SELECT has_index('public', 'kanban_tasks', 'idx_kanban_tasks_org_status_sector', 'sector access index exists');
SELECT has_index('public', 'kanban_tasks', 'idx_kanban_tasks_org_assignee_status', 'direct assignee index exists');
SELECT ok(
  EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'kanban_tasks' AND policyname = 'Tenant users view canonical task scope'),
  'canonical task SELECT policy exists'
);
SELECT ok(
  EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'kanban_tasks' AND policyname = 'Tenant users update canonical task scope'),
  'canonical task UPDATE policy exists'
);
SELECT ok(
  EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'kanban_tasks' AND policyname = 'Tenant admins delete canonical tasks'),
  'Admin-only canonical task DELETE policy exists'
);
SELECT ok(
  EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'kanban_task_comments' AND policyname = 'Tenant users view comments for accessible tasks'),
  'comments use parent task access for SELECT'
);
SELECT ok(
  EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'kanban_task_comments' AND policyname = 'Tenant users add comments to accessible tasks'),
  'comments use parent task access for INSERT'
);
SELECT ok(
  EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'calendar_events' AND policyname = 'Tenant users view canonical calendar scope'),
  'calendar uses canonical sector/module policy'
);
SELECT ok(
  EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kanban_tasks_fixed_sector_check'),
  'task sector fixed-value constraint exists'
);
SELECT ok(
  EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kanban_tasks_assigned_to_user_id_fkey'),
  'typed assignee foreign key exists'
);

SELECT * FROM finish();
ROLLBACK;
