-- Obligation delivery attempts and explicit human-confirmed completion boundary.
--
-- Rollback notes:
--   DROP TABLE public.obligation_delivery_attempts;
--   ALTER TABLE public.obligation_instances DROP COLUMN delivery_review_required;
--   ALTER TABLE public.obligation_instances DROP COLUMN delivery_review_reason;
--   ALTER TABLE public.obligation_instances DROP COLUMN ready_for_delivery_at;
--   Restore the previous obligation_instances_status_check if needed.

ALTER TABLE public.obligation_instances
  ADD COLUMN IF NOT EXISTS ready_for_delivery_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_review_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_review_reason text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'obligation_instances_status_check'
      AND conrelid = 'public.obligation_instances'::regclass
  ) THEN
    ALTER TABLE public.obligation_instances
      DROP CONSTRAINT obligation_instances_status_check;
  END IF;

  ALTER TABLE public.obligation_instances
    ADD CONSTRAINT obligation_instances_status_check
    CHECK (
      status IN (
        'pendente',
        'em_andamento',
        'aguardando_documento',
        'em_revisao',
        'pronto_para_envio',
        'enviando',
        'falha_envio',
        'concluida',
        'atrasada',
        'cancelada'
      )
    );
END $$;

CREATE TABLE IF NOT EXISTS public.obligation_delivery_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  instance_id uuid NOT NULL REFERENCES public.obligation_instances(id) ON DELETE CASCADE,
  inbox_item_id uuid REFERENCES public.document_inbox_items(id) ON DELETE SET NULL,
  sender_user_id uuid NOT NULL,
  sender_email text NOT NULL,
  verified_from_email text NOT NULL,
  display_sender_context text,
  reply_to text,
  recipient_email text NOT NULL,
  subject text NOT NULL,
  message_body text NOT NULL,
  attachment_file_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  status text NOT NULL DEFAULT 'queued',
  provider_message_id text,
  provider_status integer,
  failure_reason text,
  idempotency_key text NOT NULL,
  human_confirmed_at timestamptz,
  sent_at timestamptz,
  failed_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT obligation_delivery_attempts_status_check
    CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'cancelled')),
  CONSTRAINT obligation_delivery_attempts_recipient_email_check
    CHECK (recipient_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  CONSTRAINT obligation_delivery_attempts_sender_email_check
    CHECK (sender_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_obligation_delivery_attempts_idempotency
  ON public.obligation_delivery_attempts (idempotency_key);

CREATE INDEX IF NOT EXISTS idx_obligation_delivery_attempts_instance
  ON public.obligation_delivery_attempts (organization_id, instance_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_obligation_delivery_attempts_status
  ON public.obligation_delivery_attempts (organization_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_obligation_delivery_attempts_sender
  ON public.obligation_delivery_attempts (organization_id, sender_user_id, created_at DESC);

ALTER TABLE public.obligation_delivery_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant internal can manage obligation delivery attempts"
  ON public.obligation_delivery_attempts;
CREATE POLICY "Tenant internal can manage obligation delivery attempts"
  ON public.obligation_delivery_attempts
  FOR ALL TO authenticated
  USING (public.is_internal_user((SELECT auth.uid()), organization_id))
  WITH CHECK (public.is_internal_user((SELECT auth.uid()), organization_id));

DROP TRIGGER IF EXISTS update_obligation_delivery_attempts_updated_at
  ON public.obligation_delivery_attempts;
CREATE TRIGGER update_obligation_delivery_attempts_updated_at
  BEFORE UPDATE ON public.obligation_delivery_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.obligation_delivery_attempts TO authenticated;

UPDATE public.obligation_instances instance
SET
  delivery_review_required = true,
  delivery_review_reason = COALESCE(instance.delivery_review_reason, 'completed_without_delivery_evidence')
WHERE instance.status = 'concluida'
  AND NOT EXISTS (
    SELECT 1
    FROM public.obligation_delivery_attempts attempt
    WHERE attempt.instance_id = instance.id
      AND attempt.status = 'sent'
  );

COMMENT ON TABLE public.obligation_delivery_attempts IS
  'Durable audit trail for human-confirmed obligation guide email deliveries through Resend.';

COMMENT ON COLUMN public.obligation_instances.delivery_review_required IS
  'Flags historical or exceptional completed instances that need delivery evidence review without reopening the work.';

COMMENT ON COLUMN public.obligation_instances.ready_for_delivery_at IS
  'Set when required guide documents are attached and the instance is waiting for human email confirmation.';
