-- Expand role-based policies to support new cadastral client data categories.

DROP POLICY IF EXISTS "Role-based view client_data" ON public.client_data;
DROP POLICY IF EXISTS "Role-based insert client_data" ON public.client_data;
DROP POLICY IF EXISTS "Role-based update client_data" ON public.client_data;

CREATE POLICY "Role-based view client_data"
  ON public.client_data
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'manager')
    OR has_role(auth.uid(), 'employee')
    OR has_role(auth.uid(), 'director')
    OR (
      has_role(auth.uid(), 'departamento_pessoal')
      AND (category = 'dp' OR category LIKE 'cadastro_%')
    )
    OR (
      has_role(auth.uid(), 'fiscal')
      AND (category = 'fiscal' OR category LIKE 'cadastro_%')
    )
    OR (
      has_role(auth.uid(), 'contabil')
      AND (category = 'contabilidade' OR category LIKE 'cadastro_%')
    )
  );

CREATE POLICY "Role-based insert client_data"
  ON public.client_data
  FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'manager')
    OR has_role(auth.uid(), 'employee')
    OR (
      has_role(auth.uid(), 'departamento_pessoal')
      AND (category = 'dp' OR category LIKE 'cadastro_%')
    )
    OR (
      has_role(auth.uid(), 'fiscal')
      AND (category = 'fiscal' OR category LIKE 'cadastro_%')
    )
    OR (
      has_role(auth.uid(), 'contabil')
      AND (category = 'contabilidade' OR category LIKE 'cadastro_%')
    )
  );

CREATE POLICY "Role-based update client_data"
  ON public.client_data
  FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'manager')
    OR has_role(auth.uid(), 'employee')
    OR (
      has_role(auth.uid(), 'departamento_pessoal')
      AND (category = 'dp' OR category LIKE 'cadastro_%')
    )
    OR (
      has_role(auth.uid(), 'fiscal')
      AND (category = 'fiscal' OR category LIKE 'cadastro_%')
    )
    OR (
      has_role(auth.uid(), 'contabil')
      AND (category = 'contabilidade' OR category LIKE 'cadastro_%')
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'manager')
    OR has_role(auth.uid(), 'employee')
    OR (
      has_role(auth.uid(), 'departamento_pessoal')
      AND (category = 'dp' OR category LIKE 'cadastro_%')
    )
    OR (
      has_role(auth.uid(), 'fiscal')
      AND (category = 'fiscal' OR category LIKE 'cadastro_%')
    )
    OR (
      has_role(auth.uid(), 'contabil')
      AND (category = 'contabilidade' OR category LIKE 'cadastro_%')
    )
  );

DROP POLICY IF EXISTS "Role-based view client_files" ON public.client_files;
DROP POLICY IF EXISTS "Role-based insert client_files" ON public.client_files;

CREATE POLICY "Role-based view client_files"
  ON public.client_files
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'manager')
    OR has_role(auth.uid(), 'employee')
    OR has_role(auth.uid(), 'director')
    OR (
      has_role(auth.uid(), 'departamento_pessoal')
      AND (category = 'dp' OR category LIKE 'cadastro_%')
    )
    OR (
      has_role(auth.uid(), 'fiscal')
      AND (category = 'fiscal' OR category LIKE 'cadastro_%')
    )
    OR (
      has_role(auth.uid(), 'contabil')
      AND (category = 'contabilidade' OR category LIKE 'cadastro_%')
    )
  );

CREATE POLICY "Role-based insert client_files"
  ON public.client_files
  FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'manager')
    OR has_role(auth.uid(), 'employee')
    OR (
      has_role(auth.uid(), 'departamento_pessoal')
      AND (category = 'dp' OR category LIKE 'cadastro_%')
    )
    OR (
      has_role(auth.uid(), 'fiscal')
      AND (category = 'fiscal' OR category LIKE 'cadastro_%')
    )
    OR (
      has_role(auth.uid(), 'contabil')
      AND (category = 'contabilidade' OR category LIKE 'cadastro_%')
    )
  );

DROP POLICY IF EXISTS "Role-based upload client files" ON storage.objects;
DROP POLICY IF EXISTS "Role-based view client files" ON storage.objects;

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
      OR (
        has_role(auth.uid(), 'departamento_pessoal')
        AND (
          coalesce((storage.foldername(name))[2], '') = 'dp'
          OR coalesce((storage.foldername(name))[2], '') LIKE 'cadastro_%'
        )
      )
      OR (
        has_role(auth.uid(), 'fiscal')
        AND (
          coalesce((storage.foldername(name))[2], '') = 'fiscal'
          OR coalesce((storage.foldername(name))[2], '') LIKE 'cadastro_%'
        )
      )
      OR (
        has_role(auth.uid(), 'contabil')
        AND (
          coalesce((storage.foldername(name))[2], '') = 'contabilidade'
          OR coalesce((storage.foldername(name))[2], '') LIKE 'cadastro_%'
        )
      )
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
      OR (
        has_role(auth.uid(), 'departamento_pessoal')
        AND (
          coalesce((storage.foldername(name))[2], '') = 'dp'
          OR coalesce((storage.foldername(name))[2], '') LIKE 'cadastro_%'
        )
      )
      OR (
        has_role(auth.uid(), 'fiscal')
        AND (
          coalesce((storage.foldername(name))[2], '') = 'fiscal'
          OR coalesce((storage.foldername(name))[2], '') LIKE 'cadastro_%'
        )
      )
      OR (
        has_role(auth.uid(), 'contabil')
        AND (
          coalesce((storage.foldername(name))[2], '') = 'contabilidade'
          OR coalesce((storage.foldername(name))[2], '') LIKE 'cadastro_%'
        )
      )
    )
  );
