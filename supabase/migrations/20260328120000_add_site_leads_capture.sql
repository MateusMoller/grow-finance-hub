CREATE TABLE IF NOT EXISTS public.site_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  company_name text,
  email text NOT NULL,
  source_tag text NOT NULL DEFAULT 'captacao via site',
  origin_page text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can insert site leads" ON public.site_leads;
CREATE POLICY "Public can insert site leads"
ON public.site_leads
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Team can view site leads" ON public.site_leads;
CREATE POLICY "Team can view site leads"
ON public.site_leads
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'director')
  OR has_role(auth.uid(), 'manager')
  OR has_role(auth.uid(), 'employee')
  OR has_role(auth.uid(), 'commercial')
);

DROP POLICY IF EXISTS "Team can delete site leads" ON public.site_leads;
CREATE POLICY "Team can delete site leads"
ON public.site_leads
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'director')
  OR has_role(auth.uid(), 'manager')
  OR has_role(auth.uid(), 'employee')
  OR has_role(auth.uid(), 'commercial')
);
