-- User settings persisted per user
CREATE TABLE IF NOT EXISTS public.user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  phone text,
  job_title text,
  company_name text,
  company_document text,
  company_email text,
  company_phone text,
  company_website text,
  notify_assigned_tasks boolean NOT NULL DEFAULT true,
  notify_due_soon boolean NOT NULL DEFAULT true,
  notify_new_forms boolean NOT NULL DEFAULT true,
  notify_new_leads boolean NOT NULL DEFAULT true,
  notify_daily_email boolean NOT NULL DEFAULT true,
  theme_preference text NOT NULL DEFAULT 'system',
  language_code text NOT NULL DEFAULT 'pt-BR',
  compact_mode boolean NOT NULL DEFAULT false,
  integrations_calendar_sync boolean NOT NULL DEFAULT false,
  integrations_drive_sync boolean NOT NULL DEFAULT false,
  integrations_webhook_url text,
  integrations_api_access boolean NOT NULL DEFAULT false,
  integrations_api_token text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS company_document text,
  ADD COLUMN IF NOT EXISTS company_email text,
  ADD COLUMN IF NOT EXISTS company_phone text,
  ADD COLUMN IF NOT EXISTS company_website text,
  ADD COLUMN IF NOT EXISTS notify_assigned_tasks boolean,
  ADD COLUMN IF NOT EXISTS notify_due_soon boolean,
  ADD COLUMN IF NOT EXISTS notify_new_forms boolean,
  ADD COLUMN IF NOT EXISTS notify_new_leads boolean,
  ADD COLUMN IF NOT EXISTS notify_daily_email boolean,
  ADD COLUMN IF NOT EXISTS theme_preference text,
  ADD COLUMN IF NOT EXISTS language_code text,
  ADD COLUMN IF NOT EXISTS compact_mode boolean,
  ADD COLUMN IF NOT EXISTS integrations_calendar_sync boolean,
  ADD COLUMN IF NOT EXISTS integrations_drive_sync boolean,
  ADD COLUMN IF NOT EXISTS integrations_webhook_url text,
  ADD COLUMN IF NOT EXISTS integrations_api_access boolean,
  ADD COLUMN IF NOT EXISTS integrations_api_token text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

ALTER TABLE public.user_settings
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN notify_assigned_tasks SET DEFAULT true,
  ALTER COLUMN notify_assigned_tasks SET NOT NULL,
  ALTER COLUMN notify_due_soon SET DEFAULT true,
  ALTER COLUMN notify_due_soon SET NOT NULL,
  ALTER COLUMN notify_new_forms SET DEFAULT true,
  ALTER COLUMN notify_new_forms SET NOT NULL,
  ALTER COLUMN notify_new_leads SET DEFAULT true,
  ALTER COLUMN notify_new_leads SET NOT NULL,
  ALTER COLUMN notify_daily_email SET DEFAULT true,
  ALTER COLUMN notify_daily_email SET NOT NULL,
  ALTER COLUMN theme_preference SET DEFAULT 'system',
  ALTER COLUMN theme_preference SET NOT NULL,
  ALTER COLUMN language_code SET DEFAULT 'pt-BR',
  ALTER COLUMN language_code SET NOT NULL,
  ALTER COLUMN compact_mode SET DEFAULT false,
  ALTER COLUMN compact_mode SET NOT NULL,
  ALTER COLUMN integrations_calendar_sync SET DEFAULT false,
  ALTER COLUMN integrations_calendar_sync SET NOT NULL,
  ALTER COLUMN integrations_drive_sync SET DEFAULT false,
  ALTER COLUMN integrations_drive_sync SET NOT NULL,
  ALTER COLUMN integrations_api_access SET DEFAULT false,
  ALTER COLUMN integrations_api_access SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS user_settings_user_id_key ON public.user_settings(user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_settings_user_id_fkey'
  ) THEN
    ALTER TABLE public.user_settings
      ADD CONSTRAINT user_settings_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own settings" ON public.user_settings;
CREATE POLICY "Users can view own settings"
ON public.user_settings
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
CREATE POLICY "Users can insert own settings"
ON public.user_settings
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
CREATE POLICY "Users can update own settings"
ON public.user_settings
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all settings" ON public.user_settings;
CREATE POLICY "Admins can view all settings"
ON public.user_settings
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS update_user_settings_updated_at ON public.user_settings;
CREATE TRIGGER update_user_settings_updated_at
BEFORE UPDATE ON public.user_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Avatar storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-avatars',
  'profile-avatars',
  true,
  2097152,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can upload own avatars" ON storage.objects;
CREATE POLICY "Users can upload own avatars"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'profile-avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can update own avatars" ON storage.objects;
CREATE POLICY "Users can update own avatars"
ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'profile-avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'profile-avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can delete own avatars" ON storage.objects;
CREATE POLICY "Users can delete own avatars"
ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'profile-avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can view own avatars" ON storage.objects;
CREATE POLICY "Users can view own avatars"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'profile-avatars'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR has_role(auth.uid(), 'admin')
  )
);