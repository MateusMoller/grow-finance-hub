ALTER TABLE public.obligation_templates
  ADD COLUMN IF NOT EXISTS technical_due_month_reference text;

UPDATE public.obligation_templates
SET technical_due_month_reference = 'vigente'
WHERE technical_due_month_reference IS NULL;

ALTER TABLE public.obligation_templates
  ALTER COLUMN technical_due_month_reference SET DEFAULT 'vigente';

ALTER TABLE public.obligation_templates
  ALTER COLUMN technical_due_month_reference SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'obligation_templates_technical_due_month_reference_check'
  ) THEN
    ALTER TABLE public.obligation_templates
      ADD CONSTRAINT obligation_templates_technical_due_month_reference_check
      CHECK (technical_due_month_reference IN ('vigente', 'anterior'));
  END IF;
END $$;
