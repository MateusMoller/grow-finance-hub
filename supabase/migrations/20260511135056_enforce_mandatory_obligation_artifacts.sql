UPDATE public.obligation_templates
SET
  generates_calendar = true,
  generates_kanban = true,
  requires_document = true
WHERE
  generates_calendar IS DISTINCT FROM true
  OR generates_kanban IS DISTINCT FROM true
  OR requires_document IS DISTINCT FROM true;

UPDATE public.obligation_instances
SET document_required = true
WHERE document_required IS DISTINCT FROM true;
