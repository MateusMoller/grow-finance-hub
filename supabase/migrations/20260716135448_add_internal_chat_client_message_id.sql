ALTER TABLE public.internal_chat_messages
  ADD COLUMN IF NOT EXISTS client_message_id text;

ALTER TABLE public.internal_chat_messages
  DROP CONSTRAINT IF EXISTS internal_chat_messages_client_message_id_length;

ALTER TABLE public.internal_chat_messages
  ADD CONSTRAINT internal_chat_messages_client_message_id_length
  CHECK (
    client_message_id IS NULL
    OR (
      char_length(trim(client_message_id)) > 0
      AND char_length(client_message_id) <= 120
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS internal_chat_messages_client_message_id_unique_idx
  ON public.internal_chat_messages (organization_id, user_id, client_message_id)
  WHERE client_message_id IS NOT NULL;
