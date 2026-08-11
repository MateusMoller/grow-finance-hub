ALTER TABLE public.obligation_delivery_attempts
  ADD COLUMN IF NOT EXISTS delivery_channel text NOT NULL DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS recipient_phone text;

ALTER TABLE public.obligation_delivery_attempts
  ALTER COLUMN recipient_email DROP NOT NULL;

ALTER TABLE public.obligation_delivery_attempts
  DROP CONSTRAINT IF EXISTS obligation_delivery_attempts_recipient_email_check;

ALTER TABLE public.obligation_delivery_attempts
  DROP CONSTRAINT IF EXISTS obligation_delivery_attempts_delivery_channel_check,
  DROP CONSTRAINT IF EXISTS obligation_delivery_attempts_recipient_check;

ALTER TABLE public.obligation_delivery_attempts
  ADD CONSTRAINT obligation_delivery_attempts_delivery_channel_check
    CHECK (delivery_channel IN ('email', 'whatsapp')),
  ADD CONSTRAINT obligation_delivery_attempts_recipient_check
    CHECK (
      (delivery_channel = 'email'
        AND recipient_email IS NOT NULL
        AND recipient_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
      OR
      (delivery_channel = 'whatsapp'
        AND recipient_phone IS NOT NULL
        AND recipient_phone ~ '^[0-9]{10,15}$')
    );

CREATE INDEX IF NOT EXISTS idx_obligation_delivery_attempts_channel
  ON public.obligation_delivery_attempts (organization_id, delivery_channel, created_at DESC);

COMMENT ON COLUMN public.obligation_delivery_attempts.delivery_channel IS
  'Canal efetivo usado na entrega: email ou whatsapp.';
COMMENT ON COLUMN public.obligation_delivery_attempts.recipient_phone IS
  'Telefone normalizado, com codigo do pais, usado na entrega por WhatsApp.';

ALTER TABLE public.obligation_document_delivery_links
  ADD COLUMN IF NOT EXISTS recipient_phone text;

ALTER TABLE public.obligation_document_delivery_links
  ALTER COLUMN recipient_email DROP NOT NULL;

ALTER TABLE public.obligation_document_delivery_links
  DROP CONSTRAINT IF EXISTS obligation_document_delivery_links_recipient_check;

ALTER TABLE public.obligation_document_delivery_links
  ADD CONSTRAINT obligation_document_delivery_links_recipient_check
    CHECK (recipient_email IS NOT NULL OR recipient_phone IS NOT NULL);
