WITH latest_manual_link AS (
  SELECT DISTINCT ON (event.conversation_id)
    event.conversation_id,
    (event.details->>'client_id')::uuid AS client_id
  FROM public.whatsapp_conversation_events event
  WHERE event.event_type = 'client_link_changed'
    AND event.details ? 'client_id'
    AND event.details->>'client_id' <> ''
  ORDER BY event.conversation_id, event.created_at DESC
),
valid_manual_link AS (
  SELECT
    conversation.id AS conversation_id,
    conversation.contact_id,
    client.id AS client_id
  FROM latest_manual_link link
  JOIN public.whatsapp_conversations conversation
    ON conversation.id = link.conversation_id
  JOIN public.clients client
    ON client.id = link.client_id
   AND client.organization_id = conversation.organization_id
   AND client.status = 'Ativo'
)
UPDATE public.whatsapp_contacts contact
SET client_id = link.client_id,
    match_status = 'manual',
    auto_link_source = 'manual',
    updated_at = now()
FROM valid_manual_link link
WHERE contact.id = link.contact_id
  AND (
    contact.client_id IS DISTINCT FROM link.client_id
    OR contact.match_status IS DISTINCT FROM 'manual'
    OR contact.auto_link_source IS DISTINCT FROM 'manual'
  );

WITH latest_manual_link AS (
  SELECT DISTINCT ON (event.conversation_id)
    event.conversation_id,
    (event.details->>'client_id')::uuid AS client_id
  FROM public.whatsapp_conversation_events event
  WHERE event.event_type = 'client_link_changed'
    AND event.details ? 'client_id'
    AND event.details->>'client_id' <> ''
  ORDER BY event.conversation_id, event.created_at DESC
),
valid_manual_link AS (
  SELECT
    conversation.id AS conversation_id,
    client.id AS client_id
  FROM latest_manual_link link
  JOIN public.whatsapp_conversations conversation
    ON conversation.id = link.conversation_id
  JOIN public.clients client
    ON client.id = link.client_id
   AND client.organization_id = conversation.organization_id
   AND client.status = 'Ativo'
)
UPDATE public.whatsapp_conversations conversation
SET client_id = link.client_id,
    updated_at = now()
FROM valid_manual_link link
WHERE conversation.id = link.conversation_id
  AND conversation.client_id IS DISTINCT FROM link.client_id;
