CREATE TABLE IF NOT EXISTS public.expected_document_reference_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.obligation_templates(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.client_obligation_profiles(id) ON DELETE CASCADE,
  document_type_key text NOT NULL,
  file_name text NOT NULL,
  storage_bucket text NOT NULL DEFAULT 'obligation-files',
  storage_path text NOT NULL,
  content_type text,
  file_size bigint,
  is_active boolean NOT NULL DEFAULT true,
  source_kind text NOT NULL DEFAULT 'template_reference',
  extracted_text text,
  extracted_text_preview text,
  text_extraction_status text NOT NULL DEFAULT 'pending',
  ocr_status text NOT NULL DEFAULT 'pending',
  fingerprint_version integer NOT NULL DEFAULT 1,
  fingerprint_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  keywords jsonb NOT NULL DEFAULT '[]'::jsonb,
  primary_cues jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT expected_document_reference_files_unique_path UNIQUE (storage_bucket, storage_path),
  CONSTRAINT expected_document_reference_files_source_kind_check CHECK (source_kind IN ('template_reference', 'profile_override')),
  CONSTRAINT expected_document_reference_files_text_extraction_status_check CHECK (text_extraction_status IN ('pending', 'completed', 'failed')),
  CONSTRAINT expected_document_reference_files_ocr_status_check CHECK (ocr_status IN ('pending', 'not_needed', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_expected_document_reference_files_template_document
  ON public.expected_document_reference_files (template_id, document_type_key, is_active);

CREATE INDEX IF NOT EXISTS idx_expected_document_reference_files_profile_id
  ON public.expected_document_reference_files (profile_id);

ALTER TABLE public.expected_document_reference_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal can view expected document reference files" ON public.expected_document_reference_files;
DROP POLICY IF EXISTS "Internal can manage expected document reference files" ON public.expected_document_reference_files;

CREATE POLICY "Internal can view expected document reference files"
  ON public.expected_document_reference_files
  FOR SELECT TO authenticated
  USING (public.is_internal_user(auth.uid()));

CREATE POLICY "Internal can manage expected document reference files"
  ON public.expected_document_reference_files
  FOR ALL TO authenticated
  USING (public.is_internal_user(auth.uid()))
  WITH CHECK (public.is_internal_user(auth.uid()));

DROP TRIGGER IF EXISTS update_expected_document_reference_files_updated_at ON public.expected_document_reference_files;
CREATE TRIGGER update_expected_document_reference_files_updated_at
  BEFORE UPDATE ON public.expected_document_reference_files
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.document_inbox_items
  ADD COLUMN IF NOT EXISTS detected_cnpj text,
  ADD COLUMN IF NOT EXISTS detected_client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS competence_detected text,
  ADD COLUMN IF NOT EXISTS reference_file_id uuid REFERENCES public.expected_document_reference_files(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reference_match_score numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reference_match_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS text_extraction_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS ocr_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS extracted_text_preview text,
  ADD COLUMN IF NOT EXISTS fingerprint_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS auto_link_block_reason text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'document_inbox_items_text_extraction_status_check'
  ) THEN
    ALTER TABLE public.document_inbox_items
      ADD CONSTRAINT document_inbox_items_text_extraction_status_check
      CHECK (text_extraction_status IN ('pending', 'completed', 'failed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'document_inbox_items_ocr_status_check'
  ) THEN
    ALTER TABLE public.document_inbox_items
      ADD CONSTRAINT document_inbox_items_ocr_status_check
      CHECK (ocr_status IN ('pending', 'not_needed', 'completed', 'failed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_document_inbox_items_detected_client_id
  ON public.document_inbox_items (detected_client_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_document_inbox_items_reference_file_id
  ON public.document_inbox_items (reference_file_id);
