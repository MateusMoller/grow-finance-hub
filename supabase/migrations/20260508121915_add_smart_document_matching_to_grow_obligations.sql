ALTER TABLE public.document_inbox_items
  ADD COLUMN IF NOT EXISTS document_type_key text,
  ADD COLUMN IF NOT EXISTS matched_by text,
  ADD COLUMN IF NOT EXISTS match_score numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS match_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS review_required boolean NOT NULL DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'document_inbox_items_matched_by_check'
  ) THEN
    ALTER TABLE public.document_inbox_items
      ADD CONSTRAINT document_inbox_items_matched_by_check
      CHECK (
        matched_by IS NULL
        OR matched_by IN (
          'manual_instance',
          'direct_expected_doc',
          'alias_match',
          'single_open_instance',
          'manual_review'
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_document_inbox_items_document_type_key
  ON public.document_inbox_items (document_type_key);

CREATE INDEX IF NOT EXISTS idx_document_inbox_items_review_required
  ON public.document_inbox_items (review_required, status, created_at DESC);

UPDATE public.document_inbox_items
SET
  matched_by = CASE
    WHEN status = 'linked' THEN COALESCE(matched_by, 'manual_instance')
    WHEN status = 'pending_review' THEN COALESCE(matched_by, 'manual_review')
    WHEN status = 'rejected' THEN COALESCE(matched_by, 'manual_review')
    ELSE matched_by
  END,
  match_score = CASE
    WHEN status = 'linked' AND match_score = 0 THEN 1.00
    WHEN status = 'pending_review' AND match_score = 0 THEN 0.45
    ELSE match_score
  END,
  review_required = CASE
    WHEN status = 'linked' THEN false
    ELSE true
  END
WHERE matched_by IS NULL
   OR match_score = 0
   OR review_required IS DISTINCT FROM (status <> 'linked');

UPDATE public.obligation_templates
SET expected_documents = COALESCE((
  SELECT jsonb_agg(
    CASE
      WHEN jsonb_typeof(item) = 'string' THEN jsonb_build_object(
        'document_type_key',
        trim(both '_' from regexp_replace(lower(regexp_replace(item #>> '{}', '[^a-zA-Z0-9]+', '_', 'g')), '_+', '_', 'g')),
        'label',
        item #>> '{}',
        'aliases',
        '[]'::jsonb,
        'required',
        true,
        'active',
        true
      )
      WHEN jsonb_typeof(item) = 'object' THEN jsonb_build_object(
        'document_type_key',
        COALESCE(NULLIF(item ->> 'document_type_key', ''), trim(both '_' from regexp_replace(lower(regexp_replace(COALESCE(item ->> 'label', 'documento'), '[^a-zA-Z0-9]+', '_', 'g')), '_+', '_', 'g'))),
        'label',
        COALESCE(NULLIF(item ->> 'label', ''), initcap(replace(COALESCE(item ->> 'document_type_key', 'documento'), '_', ' '))),
        'aliases',
        CASE
          WHEN jsonb_typeof(item -> 'aliases') = 'array' THEN item -> 'aliases'
          ELSE '[]'::jsonb
        END,
        'required',
        COALESCE((item ->> 'required')::boolean, true),
        'active',
        COALESCE((item ->> 'active')::boolean, true)
      )
      ELSE jsonb_build_object(
        'document_type_key',
        'documento',
        'label',
        'Documento',
        'aliases',
        '[]'::jsonb,
        'required',
        true,
        'active',
        true
      )
    END
  )
  FROM jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(expected_documents) = 'array' THEN expected_documents
      ELSE '[]'::jsonb
    END
  ) AS item
), '[]'::jsonb)
WHERE expected_documents IS NOT NULL;
