INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'newsletter-media',
  'newsletter-media',
  true,
  104857600,
  ARRAY['image/*', 'video/*', 'audio/*']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public can view newsletter media" ON storage.objects;
CREATE POLICY "Public can view newsletter media"
ON storage.objects
FOR SELECT
USING (bucket_id = 'newsletter-media');

DROP POLICY IF EXISTS "Admins can upload newsletter media" ON storage.objects;
CREATE POLICY "Admins can upload newsletter media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'newsletter-media'
  AND has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "Admins can update newsletter media" ON storage.objects;
CREATE POLICY "Admins can update newsletter media"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'newsletter-media'
  AND has_role(auth.uid(), 'admin')
)
WITH CHECK (
  bucket_id = 'newsletter-media'
  AND has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "Admins can delete newsletter media" ON storage.objects;
CREATE POLICY "Admins can delete newsletter media"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'newsletter-media'
  AND has_role(auth.uid(), 'admin')
);
