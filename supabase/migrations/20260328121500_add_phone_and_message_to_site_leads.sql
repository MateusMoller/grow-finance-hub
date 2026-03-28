ALTER TABLE public.site_leads
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS message text;
