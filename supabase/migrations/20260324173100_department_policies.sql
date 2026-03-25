-- Client data: role-based access per category
DROP POLICY IF EXISTS "Team can view client_data" ON public.client_data;
DROP POLICY IF EXISTS "Team can insert client_data" ON public.client_data;
DROP POLICY IF EXISTS "Team can update client_data" ON public.client_data;

CREATE POLICY "Role-based view client_data"
  ON public.client_data
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'manager')
    OR has_role(auth.uid(), 'employee')
    OR has_role(auth.uid(), 'director')
    OR (has_role(auth.uid(), 'departamento_pessoal') AND category = 'dp')
    OR (has_role(auth.uid(), 'fiscal') AND category = 'fiscal')
    OR (has_role(auth.uid(), 'contabil') AND category = 'contabilidade')
  );

CREATE POLICY "Role-based insert client_data"
  ON public.client_data
  FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'manager')
    OR has_role(auth.uid(), 'employee')
    OR (has_role(auth.uid(), 'departamento_pessoal') AND category = 'dp')
    OR (has_role(auth.uid(), 'fiscal') AND category = 'fiscal')
    OR (has_role(auth.uid(), 'contabil') AND category = 'contabilidade')
  );

CREATE POLICY "Role-based update client_data"
  ON public.client_data
  FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'manager')
    OR has_role(auth.uid(), 'employee')
    OR (has_role(auth.uid(), 'departamento_pessoal') AND category = 'dp')
    OR (has_role(auth.uid(), 'fiscal') AND category = 'fiscal')
    OR (has_role(auth.uid(), 'contabil') AND category = 'contabilidade')
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'manager')
    OR has_role(auth.uid(), 'employee')
    OR (has_role(auth.uid(), 'departamento_pessoal') AND category = 'dp')
    OR (has_role(auth.uid(), 'fiscal') AND category = 'fiscal')
    OR (has_role(auth.uid(), 'contabil') AND category = 'contabilidade')
  );

-- Client files table: role-based access per category
DROP POLICY IF EXISTS "Team can view client_files" ON public.client_files;
DROP POLICY IF EXISTS "Team can insert client_files" ON public.client_files;

CREATE POLICY "Role-based view client_files"
  ON public.client_files
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'manager')
    OR has_role(auth.uid(), 'employee')
    OR has_role(auth.uid(), 'director')
    OR (has_role(auth.uid(), 'departamento_pessoal') AND category = 'dp')
    OR (has_role(auth.uid(), 'fiscal') AND category = 'fiscal')
    OR (has_role(auth.uid(), 'contabil') AND category = 'contabilidade')
  );

CREATE POLICY "Role-based insert client_files"
  ON public.client_files
  FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'manager')
    OR has_role(auth.uid(), 'employee')
    OR (has_role(auth.uid(), 'departamento_pessoal') AND category = 'dp')
    OR (has_role(auth.uid(), 'fiscal') AND category = 'fiscal')
    OR (has_role(auth.uid(), 'contabil') AND category = 'contabilidade')
  );

-- Storage access for bucket client-files:
-- folder convention is <client_id>/<category>/<filename>
DROP POLICY IF EXISTS "Team can upload client files" ON storage.objects;
DROP POLICY IF EXISTS "Team can view client files" ON storage.objects;

CREATE POLICY "Role-based upload client files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'client-files'
    AND (
      has_role(auth.uid(), 'admin')
      OR has_role(auth.uid(), 'manager')
      OR has_role(auth.uid(), 'employee')
      OR (has_role(auth.uid(), 'departamento_pessoal') AND (storage.foldername(name))[2] = 'dp')
      OR (has_role(auth.uid(), 'fiscal') AND (storage.foldername(name))[2] = 'fiscal')
      OR (has_role(auth.uid(), 'contabil') AND (storage.foldername(name))[2] = 'contabilidade')
    )
  );

CREATE POLICY "Role-based view client files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'client-files'
    AND (
      has_role(auth.uid(), 'admin')
      OR has_role(auth.uid(), 'manager')
      OR has_role(auth.uid(), 'employee')
      OR has_role(auth.uid(), 'director')
      OR (has_role(auth.uid(), 'departamento_pessoal') AND (storage.foldername(name))[2] = 'dp')
      OR (has_role(auth.uid(), 'fiscal') AND (storage.foldername(name))[2] = 'fiscal')
      OR (has_role(auth.uid(), 'contabil') AND (storage.foldername(name))[2] = 'contabilidade')
    )
  );
