CREATE POLICY "Clients can view own obligation templates"
  ON public.obligation_templates
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.obligation_instances oi
      JOIN public.clients c ON c.id = oi.client_id
      WHERE oi.template_id = obligation_templates.id
        AND c.portal_user_id = auth.uid()
    )
  );

CREATE POLICY "Clients can view own obligation instances"
  ON public.obligation_instances
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.clients c
      WHERE c.id = obligation_instances.client_id
        AND c.portal_user_id = auth.uid()
    )
  );

CREATE POLICY "Clients can view own obligation files"
  ON public.obligation_instance_files
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.obligation_instances oi
      JOIN public.clients c ON c.id = oi.client_id
      WHERE oi.id = obligation_instance_files.instance_id
        AND c.portal_user_id = auth.uid()
    )
  );

CREATE POLICY "Portal clients can view own obligation files"
  ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'obligation-files'
    AND EXISTS (
      SELECT 1
      FROM public.obligation_instance_files oif
      JOIN public.obligation_instances oi ON oi.id = oif.instance_id
      JOIN public.clients c ON c.id = oi.client_id
      WHERE oif.storage_bucket = storage.objects.bucket_id
        AND oif.storage_path = storage.objects.name
        AND c.portal_user_id = auth.uid()
    )
  );
