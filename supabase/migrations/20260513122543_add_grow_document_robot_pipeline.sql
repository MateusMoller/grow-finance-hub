CREATE TABLE IF NOT EXISTS public.document_ingestion_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_kind text NOT NULL DEFAULT 'web_manual',
  status text NOT NULL DEFAULT 'queued',
  classification_status text NOT NULL DEFAULT 'queued',
  application_status text NOT NULL DEFAULT 'pending',
  communication_status text NOT NULL DEFAULT 'pending',
  publication_status text NOT NULL DEFAULT 'pending',
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  detected_client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  template_id uuid REFERENCES public.obligation_templates(id) ON DELETE SET NULL,
  instance_id uuid REFERENCES public.obligation_instances(id) ON DELETE SET NULL,
  inbox_item_id uuid REFERENCES public.document_inbox_items(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  storage_bucket text NOT NULL DEFAULT 'obligation-files',
  storage_path text NOT NULL,
  file_hash text,
  file_size bigint,
  protocol_number text,
  protocol_issued_at timestamptz,
  robot_origin_path text,
  robot_machine_id text,
  review_required boolean NOT NULL DEFAULT false,
  attempts integer NOT NULL DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  last_error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_ingestion_jobs_unique_storage UNIQUE (storage_bucket, storage_path),
  CONSTRAINT document_ingestion_jobs_source_kind_check
    CHECK (source_kind IN ('web_manual', 'local_robot', 'api')),
  CONSTRAINT document_ingestion_jobs_status_check
    CHECK (status IN ('queued', 'ingested', 'review_required', 'processing', 'completed', 'failed')),
  CONSTRAINT document_ingestion_jobs_classification_status_check
    CHECK (classification_status IN ('queued', 'classified', 'review_required', 'failed')),
  CONSTRAINT document_ingestion_jobs_application_status_check
    CHECK (application_status IN ('pending', 'applied', 'skipped', 'failed')),
  CONSTRAINT document_ingestion_jobs_communication_status_check
    CHECK (communication_status IN ('pending', 'sent', 'partial', 'failed', 'not_applicable')),
  CONSTRAINT document_ingestion_jobs_publication_status_check
    CHECK (publication_status IN ('pending', 'published', 'failed', 'not_applicable')),
  CONSTRAINT document_ingestion_jobs_attempts_check
    CHECK (attempts >= 0)
);

CREATE INDEX IF NOT EXISTS idx_document_ingestion_jobs_status
  ON public.document_ingestion_jobs (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_document_ingestion_jobs_client_id
  ON public.document_ingestion_jobs (client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_document_ingestion_jobs_file_hash
  ON public.document_ingestion_jobs (file_hash);

ALTER TABLE public.document_ingestion_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal can view document ingestion jobs" ON public.document_ingestion_jobs;
DROP POLICY IF EXISTS "Internal can manage document ingestion jobs" ON public.document_ingestion_jobs;

CREATE POLICY "Internal can view document ingestion jobs"
  ON public.document_ingestion_jobs
  FOR SELECT TO authenticated
  USING (public.is_internal_user(auth.uid()));

CREATE POLICY "Internal can manage document ingestion jobs"
  ON public.document_ingestion_jobs
  FOR ALL TO authenticated
  USING (public.is_internal_user(auth.uid()))
  WITH CHECK (public.is_internal_user(auth.uid()));

DROP TRIGGER IF EXISTS update_document_ingestion_jobs_updated_at ON public.document_ingestion_jobs;
CREATE TRIGGER update_document_ingestion_jobs_updated_at
  BEFORE UPDATE ON public.document_ingestion_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.document_inbox_items
  ADD COLUMN IF NOT EXISTS ingestion_job_id uuid REFERENCES public.document_ingestion_jobs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_kind text NOT NULL DEFAULT 'web_manual',
  ADD COLUMN IF NOT EXISTS file_hash text,
  ADD COLUMN IF NOT EXISTS classification_status text NOT NULL DEFAULT 'queued',
  ADD COLUMN IF NOT EXISTS application_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS communication_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS publication_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS robot_origin_path text,
  ADD COLUMN IF NOT EXISTS robot_machine_id text,
  ADD COLUMN IF NOT EXISTS protocol_number text,
  ADD COLUMN IF NOT EXISTS protocol_issued_at timestamptz,
  ADD COLUMN IF NOT EXISTS processed_automatically boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'document_inbox_items_source_kind_check'
  ) THEN
    ALTER TABLE public.document_inbox_items
      ADD CONSTRAINT document_inbox_items_source_kind_check
      CHECK (source_kind IN ('web_manual', 'local_robot', 'api'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'document_inbox_items_classification_status_check'
  ) THEN
    ALTER TABLE public.document_inbox_items
      ADD CONSTRAINT document_inbox_items_classification_status_check
      CHECK (classification_status IN ('queued', 'classified', 'review_required', 'failed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'document_inbox_items_application_status_check'
  ) THEN
    ALTER TABLE public.document_inbox_items
      ADD CONSTRAINT document_inbox_items_application_status_check
      CHECK (application_status IN ('pending', 'applied', 'skipped', 'failed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'document_inbox_items_communication_status_check'
  ) THEN
    ALTER TABLE public.document_inbox_items
      ADD CONSTRAINT document_inbox_items_communication_status_check
      CHECK (communication_status IN ('pending', 'sent', 'partial', 'failed', 'not_applicable'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'document_inbox_items_publication_status_check'
  ) THEN
    ALTER TABLE public.document_inbox_items
      ADD CONSTRAINT document_inbox_items_publication_status_check
      CHECK (publication_status IN ('pending', 'published', 'failed', 'not_applicable'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_document_inbox_items_ingestion_job_id
  ON public.document_inbox_items (ingestion_job_id);

CREATE INDEX IF NOT EXISTS idx_document_inbox_items_source_kind
  ON public.document_inbox_items (source_kind, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_document_inbox_items_file_hash
  ON public.document_inbox_items (file_hash);

ALTER TABLE public.obligation_instances
  ADD COLUMN IF NOT EXISTS protocol_issued_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by_inbox_item_id uuid REFERENCES public.document_inbox_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS processed_automatically boolean NOT NULL DEFAULT false;

ALTER TABLE public.obligation_instance_files
  ADD COLUMN IF NOT EXISTS source_kind text NOT NULL DEFAULT 'web_manual',
  ADD COLUMN IF NOT EXISTS protocol_number text,
  ADD COLUMN IF NOT EXISTS publication_status text NOT NULL DEFAULT 'pending';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'obligation_instance_files_source_kind_check'
  ) THEN
    ALTER TABLE public.obligation_instance_files
      ADD CONSTRAINT obligation_instance_files_source_kind_check
      CHECK (source_kind IN ('web_manual', 'local_robot', 'api'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'obligation_instance_files_publication_status_check'
  ) THEN
    ALTER TABLE public.obligation_instance_files
      ADD CONSTRAINT obligation_instance_files_publication_status_check
      CHECK (publication_status IN ('pending', 'published', 'failed', 'not_applicable'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_obligation_instance_files_source_kind
  ON public.obligation_instance_files (source_kind, created_at DESC);

UPDATE public.document_inbox_items
SET
  source_kind = COALESCE(source_kind, 'web_manual'),
  classification_status = CASE
    WHEN status = 'pending_review' THEN 'review_required'
    WHEN status IN ('linked', 'rejected') THEN 'classified'
    ELSE classification_status
  END,
  application_status = CASE
    WHEN execution_status = 'applied' THEN 'applied'
    WHEN execution_status = 'skipped' THEN 'skipped'
    WHEN execution_status = 'failed' THEN 'failed'
    ELSE 'pending'
  END,
  communication_status = CASE
    WHEN execution_status = 'applied' THEN 'not_applicable'
    WHEN execution_status = 'skipped' THEN 'not_applicable'
    ELSE 'pending'
  END,
  publication_status = CASE
    WHEN execution_status = 'applied' THEN 'published'
    WHEN execution_status = 'skipped' THEN 'not_applicable'
    ELSE 'pending'
  END,
  processed_automatically = COALESCE(processed_automatically, false)
WHERE true;

UPDATE public.obligation_instances
SET processed_automatically = COALESCE(processed_automatically, false)
WHERE true;

UPDATE public.obligation_instance_files
SET
  source_kind = COALESCE(source_kind, 'web_manual'),
  publication_status = CASE
    WHEN triage_status IN ('accepted', 'reviewed') THEN 'published'
    ELSE 'pending'
  END
WHERE true;
