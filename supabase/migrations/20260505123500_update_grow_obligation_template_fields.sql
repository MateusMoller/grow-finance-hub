ALTER TABLE public.obligation_templates
  ADD COLUMN IF NOT EXISTS competence_reference text NOT NULL DEFAULT 'vigente';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'obligation_templates_competence_reference_check'
  ) THEN
    ALTER TABLE public.obligation_templates
      ADD CONSTRAINT obligation_templates_competence_reference_check
      CHECK (competence_reference IN ('vigente', 'anterior'));
  END IF;
END $$;

ALTER TABLE public.obligation_templates
  DROP COLUMN IF EXISTS sla_days;
