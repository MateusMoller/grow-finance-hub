-- Harden public-facing insert/listing surfaces without changing public UX.

UPDATE public.site_leads
SET organization_id = public.default_organization_id()
WHERE organization_id IS NULL
  AND public.default_organization_id() IS NOT NULL;

ALTER TABLE public.site_leads
  ALTER COLUMN organization_id SET DEFAULT public.default_organization_id(),
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.site_leads
  ADD CONSTRAINT site_leads_public_payload_shape
  CHECK (
    length(btrim(full_name)) BETWEEN 2 AND 160
    AND length(btrim(email)) BETWEEN 5 AND 254
    AND email ~* '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$'
    AND (company_name IS NULL OR length(btrim(company_name)) <= 180)
    AND (phone IS NULL OR length(btrim(phone)) <= 40)
    AND (message IS NULL OR length(btrim(message)) <= 2000)
    AND (origin_page IS NULL OR length(btrim(origin_page)) <= 220)
    AND length(btrim(source_tag)) BETWEEN 3 AND 80
  ) NOT VALID;

ALTER TABLE public.site_leads
  VALIDATE CONSTRAINT site_leads_public_payload_shape;

DROP POLICY IF EXISTS "Public can insert site leads" ON public.site_leads;
CREATE POLICY "Public can insert site leads"
  ON public.site_leads
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    organization_id = public.default_organization_id()
    AND length(btrim(full_name)) BETWEEN 2 AND 160
    AND length(btrim(email)) BETWEEN 5 AND 254
    AND email ~* '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$'
    AND (company_name IS NULL OR length(btrim(company_name)) <= 180)
    AND (phone IS NULL OR length(btrim(phone)) <= 40)
    AND (message IS NULL OR length(btrim(message)) <= 2000)
    AND (origin_page IS NULL OR length(btrim(origin_page)) <= 220)
    AND length(btrim(source_tag)) BETWEEN 3 AND 80
  );

DROP POLICY IF EXISTS "Public can view newsletter media" ON storage.objects;

DROP POLICY IF EXISTS "Admins can view newsletter media" ON storage.objects;
CREATE POLICY "Admins can view newsletter media"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'newsletter-media'
    AND public.has_role(auth.uid(), 'admin')
  );
