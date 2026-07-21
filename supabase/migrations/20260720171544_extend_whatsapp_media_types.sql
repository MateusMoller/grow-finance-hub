ALTER TABLE public.whatsapp_messages
  DROP CONSTRAINT IF EXISTS whatsapp_messages_message_type_check;

ALTER TABLE public.whatsapp_messages
  ADD CONSTRAINT whatsapp_messages_message_type_check
  CHECK (message_type IN ('text', 'image', 'audio', 'video', 'document', 'unknown'));

ALTER TABLE public.whatsapp_conversation_attachments
  DROP CONSTRAINT IF EXISTS whatsapp_conversation_attachments_allowed_type_check;

ALTER TABLE public.whatsapp_conversation_attachments
  ADD CONSTRAINT whatsapp_conversation_attachments_allowed_type_check
  CHECK (allowed_type IN ('image', 'audio', 'video', 'pdf', 'document') OR allowed_type IS NULL);
