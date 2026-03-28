CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  source text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed')),
  subscribed_at timestamptz NOT NULL DEFAULT now(),
  unsubscribed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (email = lower(email))
);

CREATE UNIQUE INDEX IF NOT EXISTS newsletter_subscribers_email_key
  ON public.newsletter_subscribers (email);

CREATE INDEX IF NOT EXISTS newsletter_subscribers_status_idx
  ON public.newsletter_subscribers (status);

DROP TRIGGER IF EXISTS update_newsletter_subscribers_updated_at ON public.newsletter_subscribers;
CREATE TRIGGER update_newsletter_subscribers_updated_at
  BEFORE UPDATE ON public.newsletter_subscribers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can subscribe to newsletter" ON public.newsletter_subscribers;
CREATE POLICY "Public can subscribe to newsletter"
ON public.newsletter_subscribers
FOR INSERT
TO anon, authenticated
WITH CHECK (
  status = 'active'
  AND unsubscribed_at IS NULL
  AND email = lower(trim(email))
);

DROP POLICY IF EXISTS "Admins can view newsletter subscribers" ON public.newsletter_subscribers;
CREATE POLICY "Admins can view newsletter subscribers"
ON public.newsletter_subscribers
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update newsletter subscribers" ON public.newsletter_subscribers;
CREATE POLICY "Admins can update newsletter subscribers"
ON public.newsletter_subscribers
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete newsletter subscribers" ON public.newsletter_subscribers;
CREATE POLICY "Admins can delete newsletter subscribers"
ON public.newsletter_subscribers
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.newsletters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL,
  excerpt text,
  content text NOT NULL,
  is_published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  email_sent_at timestamptz,
  email_send_error text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS newsletters_slug_key
  ON public.newsletters (slug);

CREATE INDEX IF NOT EXISTS newsletters_published_idx
  ON public.newsletters (is_published, published_at DESC);

DROP TRIGGER IF EXISTS update_newsletters_updated_at ON public.newsletters;
CREATE TRIGGER update_newsletters_updated_at
  BEFORE UPDATE ON public.newsletters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.newsletters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read published newsletters" ON public.newsletters;
CREATE POLICY "Public can read published newsletters"
ON public.newsletters
FOR SELECT
TO anon, authenticated
USING (is_published = true);

DROP POLICY IF EXISTS "Team can read all newsletters" ON public.newsletters;
CREATE POLICY "Team can read all newsletters"
ON public.newsletters
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'director')
  OR has_role(auth.uid(), 'manager')
  OR has_role(auth.uid(), 'employee')
  OR has_role(auth.uid(), 'commercial')
);

DROP POLICY IF EXISTS "Admins can insert newsletters" ON public.newsletters;
CREATE POLICY "Admins can insert newsletters"
ON public.newsletters
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update newsletters" ON public.newsletters;
CREATE POLICY "Admins can update newsletters"
ON public.newsletters
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete newsletters" ON public.newsletters;
CREATE POLICY "Admins can delete newsletters"
ON public.newsletters
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));
