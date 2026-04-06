-- Persist report presets in Supabase per authenticated user

CREATE TABLE IF NOT EXISTS public.saved_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  dataset_id text NOT NULL,
  column_keys text[] NOT NULL,
  format text NOT NULL DEFAULT 'xlsx',
  auto_generate boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'saved_reports_dataset_id_check'
  ) THEN
    ALTER TABLE public.saved_reports
      ADD CONSTRAINT saved_reports_dataset_id_check
      CHECK (dataset_id IN ('clientes', 'leads_crm', 'tarefas', 'equipe', 'financeiro'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'saved_reports_format_check'
  ) THEN
    ALTER TABLE public.saved_reports
      ADD CONSTRAINT saved_reports_format_check
      CHECK (format IN ('csv', 'xlsx'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'saved_reports_column_keys_not_empty'
  ) THEN
    ALTER TABLE public.saved_reports
      ADD CONSTRAINT saved_reports_column_keys_not_empty
      CHECK (cardinality(column_keys) > 0);
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_reports_user_name_dataset
  ON public.saved_reports (user_id, name, dataset_id);

CREATE INDEX IF NOT EXISTS idx_saved_reports_user_id
  ON public.saved_reports (user_id);

CREATE INDEX IF NOT EXISTS idx_saved_reports_updated_at
  ON public.saved_reports (updated_at DESC);

ALTER TABLE public.saved_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own saved reports" ON public.saved_reports;
DROP POLICY IF EXISTS "Users can insert own saved reports" ON public.saved_reports;
DROP POLICY IF EXISTS "Users can update own saved reports" ON public.saved_reports;
DROP POLICY IF EXISTS "Users can delete own saved reports" ON public.saved_reports;

CREATE POLICY "Users can view own saved reports"
  ON public.saved_reports
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own saved reports"
  ON public.saved_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own saved reports"
  ON public.saved_reports
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved reports"
  ON public.saved_reports
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_reports TO authenticated;

DROP TRIGGER IF EXISTS update_saved_reports_updated_at ON public.saved_reports;
CREATE TRIGGER update_saved_reports_updated_at
  BEFORE UPDATE ON public.saved_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
