ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS organization_id uuid;

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS organization_id uuid;

ALTER TABLE public.integration_api_credentials
  ADD COLUMN IF NOT EXISTS organization_id uuid;

CREATE INDEX IF NOT EXISTS idx_user_roles_organization_id
  ON public.user_roles (organization_id);

CREATE INDEX IF NOT EXISTS idx_user_settings_organization_id
  ON public.user_settings (organization_id);

CREATE INDEX IF NOT EXISTS idx_integration_api_credentials_organization_id
  ON public.integration_api_credentials (organization_id);

CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_org_role_key
  ON public.user_roles (user_id, organization_id, role);

CREATE UNIQUE INDEX IF NOT EXISTS user_settings_user_org_key
  ON public.user_settings (user_id, organization_id);

CREATE UNIQUE INDEX IF NOT EXISTS integration_api_credentials_user_org_key
  ON public.integration_api_credentials (user_id, organization_id);
