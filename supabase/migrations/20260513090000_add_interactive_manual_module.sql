CREATE TABLE IF NOT EXISTS public.manual_user_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  context_key text NOT NULL,
  module_key text NOT NULL,
  lesson_key text NOT NULL,
  status text NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT manual_user_progress_unique UNIQUE (user_id, context_key, module_key, lesson_key)
);

CREATE INDEX IF NOT EXISTS idx_manual_user_progress_user_context
  ON public.manual_user_progress (user_id, context_key);

CREATE INDEX IF NOT EXISTS idx_manual_user_progress_context_module
  ON public.manual_user_progress (context_key, module_key);

CREATE INDEX IF NOT EXISTS idx_manual_user_progress_status
  ON public.manual_user_progress (status);

ALTER TABLE public.manual_user_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own manual progress" ON public.manual_user_progress;
CREATE POLICY "Users can view own manual progress"
  ON public.manual_user_progress
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own manual progress" ON public.manual_user_progress;
CREATE POLICY "Users can insert own manual progress"
  ON public.manual_user_progress
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own manual progress" ON public.manual_user_progress;
CREATE POLICY "Users can update own manual progress"
  ON public.manual_user_progress
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own manual progress" ON public.manual_user_progress;
CREATE POLICY "Users can delete own manual progress"
  ON public.manual_user_progress
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_manual_user_progress_updated_at ON public.manual_user_progress;
CREATE TRIGGER update_manual_user_progress_updated_at
  BEFORE UPDATE ON public.manual_user_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.manual_user_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  onboarding_dismissed_at timestamptz,
  last_context_key text,
  last_module_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_manual_user_state_user_id
  ON public.manual_user_state (user_id);

ALTER TABLE public.manual_user_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own manual state" ON public.manual_user_state;
CREATE POLICY "Users can view own manual state"
  ON public.manual_user_state
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own manual state" ON public.manual_user_state;
CREATE POLICY "Users can insert own manual state"
  ON public.manual_user_state
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own manual state" ON public.manual_user_state;
CREATE POLICY "Users can update own manual state"
  ON public.manual_user_state
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own manual state" ON public.manual_user_state;
CREATE POLICY "Users can delete own manual state"
  ON public.manual_user_state
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_manual_user_state_updated_at ON public.manual_user_state;
CREATE TRIGGER update_manual_user_state_updated_at
  BEFORE UPDATE ON public.manual_user_state
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.get_manual_adoption_snapshot(
  p_context_key text DEFAULT NULL,
  p_profile text DEFAULT NULL,
  p_period_days integer DEFAULT 90
)
RETURNS TABLE (
  context_key text,
  module_key text,
  profile text,
  total_users bigint,
  completed_users bigint,
  pending_users bigint,
  avg_completion numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'director')
    OR public.has_role(auth.uid(), 'manager')
  ) THEN
    RAISE EXCEPTION 'forbidden'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH filtered_progress AS (
    SELECT
      progress.user_id,
      progress.context_key,
      progress.module_key,
      progress.lesson_key,
      progress.status,
      progress.updated_at
    FROM public.manual_user_progress AS progress
    WHERE (p_context_key IS NULL OR progress.context_key = p_context_key)
      AND (
        p_period_days IS NULL
        OR progress.updated_at >= now() - make_interval(days => GREATEST(p_period_days, 1))
      )
  ),
  user_primary_role AS (
    SELECT DISTINCT ON (role_map.user_id)
      role_map.user_id,
      role_map.role::text AS profile
    FROM public.user_roles AS role_map
    ORDER BY role_map.user_id, role_map.created_at ASC
  ),
  user_profile AS (
    SELECT
      users.user_id,
      COALESCE(primary_role.profile, 'unknown') AS profile
    FROM (SELECT DISTINCT user_id FROM filtered_progress) AS users
    LEFT JOIN user_primary_role AS primary_role
      ON primary_role.user_id = users.user_id
  ),
  lessons_by_user_module AS (
    SELECT
      fp.user_id,
      fp.context_key,
      fp.module_key,
      up.profile,
      COUNT(*)::bigint AS total_lessons,
      COUNT(*) FILTER (WHERE fp.status = 'completed')::bigint AS completed_lessons
    FROM filtered_progress AS fp
    JOIN user_profile AS up
      ON up.user_id = fp.user_id
    WHERE (p_profile IS NULL OR up.profile = p_profile)
    GROUP BY fp.user_id, fp.context_key, fp.module_key, up.profile
  ),
  module_agg AS (
    SELECT
      entry.context_key,
      entry.module_key,
      entry.profile,
      COUNT(*)::bigint AS total_users,
      COUNT(*) FILTER (WHERE entry.total_lessons > 0 AND entry.completed_lessons = entry.total_lessons)::bigint AS completed_users,
      COUNT(*) FILTER (WHERE entry.completed_lessons < entry.total_lessons)::bigint AS pending_users,
      COALESCE(AVG(
        CASE
          WHEN entry.total_lessons = 0 THEN 0
          ELSE entry.completed_lessons::numeric / entry.total_lessons::numeric
        END
      ), 0)::numeric AS avg_completion
    FROM lessons_by_user_module AS entry
    GROUP BY entry.context_key, entry.module_key, entry.profile
  ),
  context_agg AS (
    SELECT
      entry.context_key,
      '__all__'::text AS module_key,
      entry.profile,
      COUNT(*)::bigint AS total_users,
      COUNT(*) FILTER (WHERE entry.total_lessons > 0 AND entry.completed_lessons = entry.total_lessons)::bigint AS completed_users,
      COUNT(*) FILTER (WHERE entry.completed_lessons < entry.total_lessons)::bigint AS pending_users,
      COALESCE(AVG(
        CASE
          WHEN entry.total_lessons = 0 THEN 0
          ELSE entry.completed_lessons::numeric / entry.total_lessons::numeric
        END
      ), 0)::numeric AS avg_completion
    FROM lessons_by_user_module AS entry
    GROUP BY entry.context_key, entry.profile
  )
  SELECT * FROM module_agg
  UNION ALL
  SELECT * FROM context_agg
  ORDER BY context_key, module_key, profile;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_manual_adoption_snapshot(text, text, integer) TO authenticated;
