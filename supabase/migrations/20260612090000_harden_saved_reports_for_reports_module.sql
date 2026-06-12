-- Harden saved report presets for the governed reports module.
-- Rollback guidance: disable the reports feature flag first, then restore the
-- previous owner-only policies if organization-scoped access causes issues.

ALTER TABLE public.saved_reports
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS normalized_name text;

UPDATE public.saved_reports
SET organization_id = COALESCE(organization_id, public.default_organization_id())
WHERE organization_id IS NULL;

UPDATE public.saved_reports
SET normalized_name = lower(regexp_replace(trim(name), '\s+', ' ', 'g'))
WHERE normalized_name IS NULL OR normalized_name = '';

ALTER TABLE public.saved_reports
  ALTER COLUMN organization_id SET DEFAULT public.default_organization_id(),
  ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_saved_reports_org_user_updated
  ON public.saved_reports (organization_id, user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_saved_reports_org_user_dataset_name
  ON public.saved_reports (organization_id, user_id, dataset_id, normalized_name);

DROP POLICY IF EXISTS "Users can view own saved reports" ON public.saved_reports;
DROP POLICY IF EXISTS "Users can insert own saved reports" ON public.saved_reports;
DROP POLICY IF EXISTS "Users can update own saved reports" ON public.saved_reports;
DROP POLICY IF EXISTS "Users can delete own saved reports" ON public.saved_reports;

CREATE POLICY "Users can view own saved reports"
  ON public.saved_reports
  FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) = user_id
    AND public.is_internal_user((select auth.uid()), organization_id)
  );

CREATE POLICY "Users can insert own saved reports"
  ON public.saved_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
    AND public.is_internal_user((select auth.uid()), organization_id)
  );

CREATE POLICY "Users can update own saved reports"
  ON public.saved_reports
  FOR UPDATE
  TO authenticated
  USING (
    (select auth.uid()) = user_id
    AND public.is_internal_user((select auth.uid()), organization_id)
  )
  WITH CHECK (
    (select auth.uid()) = user_id
    AND public.is_internal_user((select auth.uid()), organization_id)
  );

CREATE POLICY "Users can delete own saved reports"
  ON public.saved_reports
  FOR DELETE
  TO authenticated
  USING (
    (select auth.uid()) = user_id
    AND public.is_internal_user((select auth.uid()), organization_id)
  );
