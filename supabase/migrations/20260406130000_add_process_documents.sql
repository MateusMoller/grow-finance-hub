-- Process documents shared by internal team
CREATE TABLE IF NOT EXISTS public.process_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id uuid NOT NULL,
  process_name text NOT NULL,
  process_description text,
  department text NOT NULL DEFAULT 'geral',
  status text NOT NULL DEFAULT 'aberto',
  file_name text NOT NULL,
  file_path text NOT NULL UNIQUE,
  file_size bigint,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS process_documents_process_id_idx
  ON public.process_documents (process_id);

CREATE INDEX IF NOT EXISTS process_documents_status_idx
  ON public.process_documents (status);

CREATE INDEX IF NOT EXISTS process_documents_department_idx
  ON public.process_documents (department);

ALTER TABLE public.process_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal team can view process documents" ON public.process_documents;
CREATE POLICY "Internal team can view process documents"
  ON public.process_documents
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'manager')
    OR has_role(auth.uid(), 'employee')
    OR has_role(auth.uid(), 'director')
    OR has_role(auth.uid(), 'commercial')
    OR has_role(auth.uid(), 'partner')
    OR has_role(auth.uid(), 'departamento_pessoal')
    OR has_role(auth.uid(), 'fiscal')
    OR has_role(auth.uid(), 'contabil')
  );

DROP POLICY IF EXISTS "Internal team can insert process documents" ON public.process_documents;
CREATE POLICY "Internal team can insert process documents"
  ON public.process_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      has_role(auth.uid(), 'admin')
      OR has_role(auth.uid(), 'manager')
      OR has_role(auth.uid(), 'employee')
      OR has_role(auth.uid(), 'director')
      OR has_role(auth.uid(), 'commercial')
      OR has_role(auth.uid(), 'partner')
      OR has_role(auth.uid(), 'departamento_pessoal')
      OR has_role(auth.uid(), 'fiscal')
      OR has_role(auth.uid(), 'contabil')
    )
    AND (created_by IS NULL OR created_by = auth.uid())
  );

DROP POLICY IF EXISTS "Internal team can update process documents" ON public.process_documents;
CREATE POLICY "Internal team can update process documents"
  ON public.process_documents
  FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'manager')
    OR has_role(auth.uid(), 'employee')
    OR has_role(auth.uid(), 'director')
    OR has_role(auth.uid(), 'commercial')
    OR has_role(auth.uid(), 'partner')
    OR has_role(auth.uid(), 'departamento_pessoal')
    OR has_role(auth.uid(), 'fiscal')
    OR has_role(auth.uid(), 'contabil')
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'manager')
    OR has_role(auth.uid(), 'employee')
    OR has_role(auth.uid(), 'director')
    OR has_role(auth.uid(), 'commercial')
    OR has_role(auth.uid(), 'partner')
    OR has_role(auth.uid(), 'departamento_pessoal')
    OR has_role(auth.uid(), 'fiscal')
    OR has_role(auth.uid(), 'contabil')
  );

DROP POLICY IF EXISTS "Internal team can delete process documents" ON public.process_documents;
CREATE POLICY "Internal team can delete process documents"
  ON public.process_documents
  FOR DELETE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'manager')
    OR has_role(auth.uid(), 'employee')
    OR has_role(auth.uid(), 'director')
    OR has_role(auth.uid(), 'commercial')
    OR has_role(auth.uid(), 'partner')
    OR has_role(auth.uid(), 'departamento_pessoal')
    OR has_role(auth.uid(), 'fiscal')
    OR has_role(auth.uid(), 'contabil')
  );

INSERT INTO storage.buckets (id, name, public)
VALUES ('process-documents', 'process-documents', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Internal team can upload process documents" ON storage.objects;
CREATE POLICY "Internal team can upload process documents"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'process-documents'
    AND (
      has_role(auth.uid(), 'admin')
      OR has_role(auth.uid(), 'manager')
      OR has_role(auth.uid(), 'employee')
      OR has_role(auth.uid(), 'director')
      OR has_role(auth.uid(), 'commercial')
      OR has_role(auth.uid(), 'partner')
      OR has_role(auth.uid(), 'departamento_pessoal')
      OR has_role(auth.uid(), 'fiscal')
      OR has_role(auth.uid(), 'contabil')
    )
  );

DROP POLICY IF EXISTS "Internal team can view process documents" ON storage.objects;
CREATE POLICY "Internal team can view process documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'process-documents'
    AND (
      has_role(auth.uid(), 'admin')
      OR has_role(auth.uid(), 'manager')
      OR has_role(auth.uid(), 'employee')
      OR has_role(auth.uid(), 'director')
      OR has_role(auth.uid(), 'commercial')
      OR has_role(auth.uid(), 'partner')
      OR has_role(auth.uid(), 'departamento_pessoal')
      OR has_role(auth.uid(), 'fiscal')
      OR has_role(auth.uid(), 'contabil')
    )
  );

DROP POLICY IF EXISTS "Internal team can delete process documents" ON storage.objects;
CREATE POLICY "Internal team can delete process documents"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'process-documents'
    AND (
      has_role(auth.uid(), 'admin')
      OR has_role(auth.uid(), 'manager')
      OR has_role(auth.uid(), 'employee')
      OR has_role(auth.uid(), 'director')
      OR has_role(auth.uid(), 'commercial')
      OR has_role(auth.uid(), 'partner')
      OR has_role(auth.uid(), 'departamento_pessoal')
      OR has_role(auth.uid(), 'fiscal')
      OR has_role(auth.uid(), 'contabil')
    )
  );

DROP TRIGGER IF EXISTS update_process_documents_updated_at ON public.process_documents;
CREATE TRIGGER update_process_documents_updated_at
  BEFORE UPDATE ON public.process_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
