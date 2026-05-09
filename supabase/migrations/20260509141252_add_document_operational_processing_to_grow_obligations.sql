ALTER TABLE public.document_inbox_items
  ADD COLUMN IF NOT EXISTS processing_status text NOT NULL DEFAULT 'queued',
  ADD COLUMN IF NOT EXISTS processing_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS processing_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_processing_error text,
  ADD COLUMN IF NOT EXISTS execution_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS execution_notes text,
  ADD COLUMN IF NOT EXISTS archive_path text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'document_inbox_items_processing_status_check'
  ) THEN
    ALTER TABLE public.document_inbox_items
      ADD CONSTRAINT document_inbox_items_processing_status_check
      CHECK (processing_status IN ('queued', 'processing', 'processed', 'failed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'document_inbox_items_execution_status_check'
  ) THEN
    ALTER TABLE public.document_inbox_items
      ADD CONSTRAINT document_inbox_items_execution_status_check
      CHECK (execution_status IN ('pending', 'applied', 'skipped', 'failed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'document_inbox_items_processing_attempts_check'
  ) THEN
    ALTER TABLE public.document_inbox_items
      ADD CONSTRAINT document_inbox_items_processing_attempts_check
      CHECK (processing_attempts >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_document_inbox_items_processing_status
  ON public.document_inbox_items (processing_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_document_inbox_items_execution_status
  ON public.document_inbox_items (execution_status, created_at DESC);

UPDATE public.document_inbox_items
SET
  processing_status = CASE
    WHEN status = 'linked' THEN 'processed'
    WHEN status = 'rejected' THEN 'processed'
    ELSE 'queued'
  END,
  processing_completed_at = CASE
    WHEN status IN ('linked', 'rejected') THEN COALESCE(reviewed_at, created_at)
    ELSE processing_completed_at
  END,
  execution_status = CASE
    WHEN status = 'linked' THEN 'applied'
    WHEN status = 'rejected' THEN 'skipped'
    ELSE 'pending'
  END,
  execution_notes = CASE
    WHEN status = 'linked' THEN COALESCE(execution_notes, 'Documento já vinculado na obrigação.')
    WHEN status = 'rejected' THEN COALESCE(execution_notes, 'Documento rejeitado na triagem.')
    ELSE execution_notes
  END
WHERE processing_status IS DISTINCT FROM CASE
  WHEN status = 'linked' THEN 'processed'
  WHEN status = 'rejected' THEN 'processed'
  ELSE 'queued'
END
OR execution_status IS DISTINCT FROM CASE
  WHEN status = 'linked' THEN 'applied'
  WHEN status = 'rejected' THEN 'skipped'
  ELSE 'pending'
END;
