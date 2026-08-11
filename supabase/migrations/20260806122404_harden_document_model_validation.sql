ALTER TABLE public.expected_document_reference_files
  ADD COLUMN IF NOT EXISTS model_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS validation_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS validated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS validation_sample_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS validation_correct_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS validation_false_positive_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_validated_at timestamptz;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='expected_document_reference_files_model_version_check') THEN
    ALTER TABLE public.expected_document_reference_files ADD CONSTRAINT expected_document_reference_files_model_version_check CHECK (model_version > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='expected_document_reference_files_validation_status_check') THEN
    ALTER TABLE public.expected_document_reference_files ADD CONSTRAINT expected_document_reference_files_validation_status_check
      CHECK (validation_status IN ('draft','validating','approved','inactive'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='expected_document_reference_files_validation_counts_check') THEN
    ALTER TABLE public.expected_document_reference_files ADD CONSTRAINT expected_document_reference_files_validation_counts_check
      CHECK (validation_sample_count >= 0 AND validation_correct_count >= 0 AND validation_false_positive_count >= 0
        AND validation_correct_count + validation_false_positive_count <= validation_sample_count);
  END IF;
END $$;

ALTER TABLE public.document_inbox_items
  ADD COLUMN IF NOT EXISTS recognition_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS original_match_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS correction_reason text,
  ADD COLUMN IF NOT EXISTS corrected_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS corrected_at timestamptz,
  ADD COLUMN IF NOT EXISTS recognition_decision text NOT NULL DEFAULT 'pending';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='document_inbox_items_recognition_decision_check') THEN
    ALTER TABLE public.document_inbox_items ADD CONSTRAINT document_inbox_items_recognition_decision_check
      CHECK (recognition_decision IN ('pending','automatic','manual_review','manual_corrected','rejected'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.document_model_validation_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  reference_file_id uuid NOT NULL REFERENCES public.expected_document_reference_files(id) ON DELETE CASCADE,
  inbox_item_id uuid REFERENCES public.document_inbox_items(id) ON DELETE SET NULL,
  expected_client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  expected_template_id uuid REFERENCES public.obligation_templates(id) ON DELETE SET NULL,
  expected_competence text,
  actual_client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  actual_template_id uuid REFERENCES public.obligation_templates(id) ON DELETE SET NULL,
  actual_competence text,
  result text NOT NULL CHECK (result IN ('correct','false_positive','false_negative','review_required')),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  tested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  tested_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reference_file_id,inbox_item_id)
);
CREATE INDEX IF NOT EXISTS idx_document_model_validation_samples_reference
  ON public.document_model_validation_samples (organization_id,reference_file_id,tested_at DESC);
ALTER TABLE public.document_model_validation_samples ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Internal can view document model validations" ON public.document_model_validation_samples;
CREATE POLICY "Internal can view document model validations" ON public.document_model_validation_samples FOR SELECT TO authenticated
  USING (public.is_internal_user((SELECT auth.uid()),organization_id));
DROP POLICY IF EXISTS "Managers can manage document model validations" ON public.document_model_validation_samples;
CREATE POLICY "Managers can manage document model validations" ON public.document_model_validation_samples FOR ALL TO authenticated
  USING (public.has_org_role((SELECT auth.uid()),organization_id,'admin') OR public.has_org_role((SELECT auth.uid()),organization_id,'manager'))
  WITH CHECK (public.has_org_role((SELECT auth.uid()),organization_id,'admin') OR public.has_org_role((SELECT auth.uid()),organization_id,'manager'));
GRANT SELECT,INSERT,UPDATE,DELETE ON public.document_model_validation_samples TO authenticated;
GRANT ALL ON public.document_model_validation_samples TO service_role;

UPDATE public.expected_document_reference_files
SET validation_status=CASE
  WHEN jsonb_array_length(coalesce(fingerprint_payload->'extraction_zones'->'zones','[]'::jsonb)) >= 2 THEN 'validating'
  ELSE 'draft' END
WHERE validation_status='draft';
