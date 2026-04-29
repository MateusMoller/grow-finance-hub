ALTER TABLE public.ai_action_logs
ADD COLUMN IF NOT EXISTS risk_level text NOT NULL DEFAULT 'baixo',
ADD COLUMN IF NOT EXISTS requires_confirmation boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS requires_human_review boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
ADD COLUMN IF NOT EXISTS executed_at timestamptz,
ADD COLUMN IF NOT EXISTS confirmation_expires_at timestamptz,
ADD COLUMN IF NOT EXISTS channel text,
ADD COLUMN IF NOT EXISTS external_reference text;

CREATE INDEX IF NOT EXISTS idx_ai_action_logs_status_created_at
  ON public.ai_action_logs (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.whatsapp_webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  direction text NOT NULL,
  phone text,
  message_type text,
  provider_message_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processing_status text NOT NULL DEFAULT 'received',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_webhook_logs_created_at
  ON public.whatsapp_webhook_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_webhook_logs_phone_created_at
  ON public.whatsapp_webhook_logs (phone, created_at DESC);

ALTER TABLE public.whatsapp_webhook_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal can view whatsapp webhook logs" ON public.whatsapp_webhook_logs;

CREATE POLICY "Internal can view whatsapp webhook logs"
  ON public.whatsapp_webhook_logs
  FOR SELECT
  TO authenticated
  USING (public.is_internal_user(auth.uid()));
