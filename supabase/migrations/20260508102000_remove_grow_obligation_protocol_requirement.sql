ALTER TABLE public.obligation_templates
  DROP COLUMN IF EXISTS requires_protocol;

ALTER TABLE public.obligation_instances
  DROP COLUMN IF EXISTS protocol_required;
