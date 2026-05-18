ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE DEFAULT public.default_organization_id();

UPDATE public.user_settings
SET organization_id = public.default_organization_id()
WHERE organization_id IS NULL;

ALTER TABLE public.user_settings
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.integration_api_credentials
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE DEFAULT public.default_organization_id();

UPDATE public.integration_api_credentials
SET organization_id = public.default_organization_id()
WHERE organization_id IS NULL;

ALTER TABLE public.integration_api_credentials
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.integration_api_credentials
  DROP CONSTRAINT IF EXISTS integration_api_credentials_user_id_key;

ALTER TABLE public.user_settings
  DROP CONSTRAINT IF EXISTS user_settings_user_id_key;

DROP INDEX IF EXISTS public.user_settings_user_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS user_settings_user_org_key
  ON public.user_settings (user_id, organization_id);

CREATE UNIQUE INDEX IF NOT EXISTS integration_api_credentials_user_org_key
  ON public.integration_api_credentials (user_id, organization_id);

CREATE INDEX IF NOT EXISTS idx_user_settings_organization_id
  ON public.user_settings (organization_id);

CREATE INDEX IF NOT EXISTS idx_integration_api_credentials_organization_id
  ON public.integration_api_credentials (organization_id);

DROP POLICY IF EXISTS "Users can view own settings" ON public.user_settings;
CREATE POLICY "Users can view own settings"
ON public.user_settings
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
CREATE POLICY "Users can insert own settings"
ON public.user_settings
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    public.is_internal_user(auth.uid(), organization_id)
    OR EXISTS (
      SELECT 1
      FROM public.client_users cu
      WHERE cu.user_id = auth.uid()
        AND cu.organization_id = user_settings.organization_id
        AND cu.status = 'active'
    )
  )
);

DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
CREATE POLICY "Users can update own settings"
ON public.user_settings
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND (
    public.is_internal_user(auth.uid(), organization_id)
    OR EXISTS (
      SELECT 1
      FROM public.client_users cu
      WHERE cu.user_id = auth.uid()
        AND cu.organization_id = user_settings.organization_id
        AND cu.status = 'active'
    )
  )
);

DROP POLICY IF EXISTS "Admins can view all settings" ON public.user_settings;
CREATE POLICY "Tenant admins can view organization settings"
ON public.user_settings
FOR SELECT TO authenticated
USING (
  public.has_org_role(auth.uid(), organization_id, 'admin')
  OR public.has_org_role(auth.uid(), organization_id, 'director')
  OR public.has_org_role(auth.uid(), organization_id, 'manager')
);
