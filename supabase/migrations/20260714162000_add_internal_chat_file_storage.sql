INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('internal-chat-files', 'internal-chat-files', false, 52428800)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 52428800;

DROP POLICY IF EXISTS "Internal team can upload chat files" ON storage.objects;
DROP POLICY IF EXISTS "Internal team can view chat files" ON storage.objects;
DROP POLICY IF EXISTS "Internal team can delete own chat files" ON storage.objects;

CREATE POLICY "Internal team can upload chat files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'internal-chat-files'
    AND (storage.foldername(name))[2] = (select auth.uid())::text
    AND public.is_internal_user(
      (select auth.uid()),
      ((storage.foldername(name))[1])::uuid
    )
  );

CREATE POLICY "Internal team can view chat files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'internal-chat-files'
    AND public.is_internal_user(
      (select auth.uid()),
      ((storage.foldername(name))[1])::uuid
    )
  );

CREATE POLICY "Internal team can delete own chat files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'internal-chat-files'
    AND (
      (storage.foldername(name))[2] = (select auth.uid())::text
      OR public.has_org_role((select auth.uid()), ((storage.foldername(name))[1])::uuid, 'admin')
      OR public.has_org_role((select auth.uid()), ((storage.foldername(name))[1])::uuid, 'manager')
    )
  );
