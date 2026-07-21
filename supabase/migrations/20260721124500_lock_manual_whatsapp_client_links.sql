CREATE OR REPLACE FUNCTION public.lock_manual_whatsapp_client_link()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.client_id IS NOT NULL
    AND (OLD.match_status = 'manual' OR OLD.auto_link_source = 'manual')
    AND NOT (
      NEW.client_id IS NOT NULL
      AND NEW.match_status = 'manual'
      AND NEW.auto_link_source = 'manual'
    )
  THEN
    NEW.client_id := OLD.client_id;
    NEW.match_status := 'manual';
    NEW.auto_link_source := 'manual';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lock_manual_whatsapp_client_link_trigger
  ON public.whatsapp_contacts;

CREATE TRIGGER lock_manual_whatsapp_client_link_trigger
BEFORE UPDATE ON public.whatsapp_contacts
FOR EACH ROW
EXECUTE FUNCTION public.lock_manual_whatsapp_client_link();

UPDATE public.whatsapp_conversations conversation
SET client_id = contact.client_id,
    updated_at = now()
FROM public.whatsapp_contacts contact
WHERE conversation.contact_id = contact.id
  AND contact.client_id IS NOT NULL
  AND (contact.match_status = 'manual' OR contact.auto_link_source = 'manual')
  AND conversation.client_id IS DISTINCT FROM contact.client_id;
