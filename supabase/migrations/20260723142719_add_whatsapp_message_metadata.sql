ALTER TABLE public.whatsapp_messages
ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.whatsapp_messages
SET metadata = jsonb_build_object(
  'interactive',
  jsonb_build_object(
    'type',
    'button',
    'buttons',
    jsonb_build_array(
      jsonb_build_object('id', 'grow:auto:attendance', 'title', 'Atendimento'),
      jsonb_build_object('id', 'grow:auto:requests', 'title', 'Solicitações')
    )
  )
)
WHERE direction = 'outbound'
  AND (
    coalesce(metadata, '{}'::jsonb) = '{}'::jsonb
    OR metadata #>> '{interactive,buttons,0,id}' = 'grow:auto:new_request'
  )
  AND (
    body ILIKE 'Como podemos ajudar? Escolha uma op%'
    OR body ILIKE 'Encontrei tickets ativos para este contato%'
  );
