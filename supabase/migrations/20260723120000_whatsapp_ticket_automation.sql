-- WhatsApp ticket automation foundation.
-- Rollout notes:
-- 1. Apply this migration before enabling whatsapp-ticket-actions or scheduled ticket automations.
-- 2. Keep WhatsApp provider secrets in Supabase function environment variables only.
-- 3. This migration is additive and keeps existing WhatsApp conversations/messages intact.
--
-- Rollback notes:
-- 1. Disable webhook ticket routing, ticket actions and ticket automations before dropping tables.
-- 2. Export whatsapp_ticket_events and whatsapp_task_message_links if audit retention is required.
-- 3. Drop storage policy "WhatsApp ticket users can read ticket media" before removing media records.

CREATE TABLE IF NOT EXISTS public.whatsapp_customer_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.whatsapp_contacts(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES public.whatsapp_conversations(id) ON DELETE SET NULL,
  task_id uuid NOT NULL REFERENCES public.kanban_tasks(id) ON DELETE CASCADE,
  public_protocol text NOT NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'waiting_customer', 'waiting_team', 'resolved', 'closed', 'cancelled')),
  responsible_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  responsible_name text,
  opened_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  opened_from_message_id uuid REFERENCES public.whatsapp_messages(id) ON DELETE SET NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  first_response_due_at timestamptz,
  resolution_due_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  last_customer_message_at timestamptz,
  last_agent_message_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_customer_tickets_protocol_format
    CHECK (public_protocol ~ '^WAT-[0-9]{6}-[A-Z0-9]{6}$')
);

CREATE TABLE IF NOT EXISTS public.whatsapp_task_message_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ticket_id uuid REFERENCES public.whatsapp_customer_tickets(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.kanban_tasks(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES public.whatsapp_messages(id) ON DELETE CASCADE,
  attachment_id uuid REFERENCES public.whatsapp_conversation_attachments(id) ON DELETE SET NULL,
  relation_type text NOT NULL
    CHECK (relation_type IN ('origin', 'customer_reply', 'agent_reply', 'document', 'context', 'ticket_opening', 'manual_link', 'completion', 'reopening')),
  visibility text NOT NULL DEFAULT 'customer' CHECK (visibility IN ('customer', 'internal')),
  route_source text
    CHECK (route_source IN ('quoted_reply', 'interactive_selection', 'protocol', 'active_context', 'inference', 'triage') OR route_source IS NULL),
  route_confidence_percent integer CHECK (route_confidence_percent BETWEEN 0 AND 100 OR route_confidence_percent IS NULL),
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_active_ticket_contexts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.whatsapp_contacts(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES public.whatsapp_customer_tickets(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.kanban_tasks(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('interactive_selection', 'protocol', 'active_context')),
  selected_message_id uuid REFERENCES public.whatsapp_messages(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  cleared_at timestamptz,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_task_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.whatsapp_contacts(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  source_message_id uuid REFERENCES public.whatsapp_messages(id) ON DELETE SET NULL,
  suggested_title text NOT NULL,
  suggested_description text,
  suggested_sector text,
  suggested_priority text,
  confidence_percent integer NOT NULL DEFAULT 0 CHECK (confidence_percent BETWEEN 0 AND 100),
  classification_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'discarded', 'linked_existing')),
  approved_task_id uuid REFERENCES public.kanban_tasks(id) ON DELETE SET NULL,
  approved_ticket_id uuid REFERENCES public.whatsapp_customer_tickets(id) ON DELETE SET NULL,
  discard_reason text,
  reviewed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_ticket_sla_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES public.whatsapp_customer_tickets(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.kanban_tasks(id) ON DELETE CASCADE,
  state text NOT NULL DEFAULT 'running'
    CHECK (state IN ('running', 'paused_waiting_customer', 'resolved', 'breached')),
  first_response_due_at timestamptz,
  resolution_due_at timestamptz,
  warning_sent_at timestamptz,
  breached_at timestamptz,
  paused_at timestamptz,
  resumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_ticket_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ticket_id uuid REFERENCES public.whatsapp_customer_tickets(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.kanban_tasks(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES public.whatsapp_conversations(id) ON DELETE SET NULL,
  message_id uuid REFERENCES public.whatsapp_messages(id) ON DELETE SET NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_ticket_automation_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  active_context_minutes integer NOT NULL DEFAULT 1440 CHECK (active_context_minutes BETWEEN 5 AND 10080),
  high_confidence_threshold_percent integer NOT NULL DEFAULT 90 CHECK (high_confidence_threshold_percent BETWEEN 50 AND 100),
  first_response_sla_minutes integer NOT NULL DEFAULT 240 CHECK (first_response_sla_minutes > 0),
  resolution_sla_minutes integer NOT NULL DEFAULT 2880 CHECK (resolution_sla_minutes > 0),
  waiting_customer_reminder_minutes integer NOT NULL DEFAULT 1440 CHECK (waiting_customer_reminder_minutes > 0),
  close_resolved_after_minutes integer NOT NULL DEFAULT 4320 CHECK (close_resolved_after_minutes > 0),
  default_ticket_opening_message text NOT NULL DEFAULT 'Recebemos sua solicitacao e nossa equipe dara continuidade ao atendimento por este ticket.',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_whatsapp_customer_tickets_protocol
  ON public.whatsapp_customer_tickets (organization_id, public_protocol);

CREATE UNIQUE INDEX IF NOT EXISTS ux_whatsapp_customer_tickets_task
  ON public.whatsapp_customer_tickets (organization_id, task_id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_whatsapp_task_message_links_message_relation
  ON public.whatsapp_task_message_links (organization_id, message_id, relation_type, ticket_id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_whatsapp_active_ticket_contexts_open
  ON public.whatsapp_active_ticket_contexts (organization_id, conversation_id)
  WHERE cleared_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_whatsapp_task_suggestions_idempotency
  ON public.whatsapp_task_suggestions (organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_whatsapp_task_suggestions_source_pending
  ON public.whatsapp_task_suggestions (organization_id, source_message_id)
  WHERE source_message_id IS NOT NULL AND status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS ux_whatsapp_ticket_sla_records_ticket
  ON public.whatsapp_ticket_sla_records (organization_id, ticket_id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_whatsapp_ticket_events_idempotency
  ON public.whatsapp_ticket_events (organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_customer_tickets_org_client_status
  ON public.whatsapp_customer_tickets (organization_id, client_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_customer_tickets_org_contact_status
  ON public.whatsapp_customer_tickets (organization_id, contact_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_customer_tickets_org_conversation_status
  ON public.whatsapp_customer_tickets (organization_id, conversation_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_customer_tickets_responsible
  ON public.whatsapp_customer_tickets (organization_id, responsible_user_id, status);

CREATE INDEX IF NOT EXISTS idx_whatsapp_task_message_links_task_created
  ON public.whatsapp_task_message_links (organization_id, task_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_task_message_links_ticket_created
  ON public.whatsapp_task_message_links (organization_id, ticket_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_active_ticket_contexts_expiry
  ON public.whatsapp_active_ticket_contexts (organization_id, expires_at)
  WHERE cleared_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_task_suggestions_queue
  ON public.whatsapp_task_suggestions (organization_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_ticket_sla_records_due
  ON public.whatsapp_ticket_sla_records (organization_id, state, resolution_due_at, first_response_due_at);

CREATE INDEX IF NOT EXISTS idx_whatsapp_ticket_events_lookup
  ON public.whatsapp_ticket_events (organization_id, ticket_id, created_at DESC);

ALTER TABLE public.whatsapp_customer_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_task_message_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_active_ticket_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_task_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_ticket_sla_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_ticket_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_ticket_automation_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "WhatsApp users can read customer tickets" ON public.whatsapp_customer_tickets;
CREATE POLICY "WhatsApp users can read customer tickets"
  ON public.whatsapp_customer_tickets FOR SELECT TO authenticated
  USING (public.has_effective_module_access((SELECT auth.uid()), organization_id, 'whatsapp'));

DROP POLICY IF EXISTS "WhatsApp users can read task message links" ON public.whatsapp_task_message_links;
CREATE POLICY "WhatsApp users can read task message links"
  ON public.whatsapp_task_message_links FOR SELECT TO authenticated
  USING (
    public.has_effective_module_access((SELECT auth.uid()), organization_id, 'whatsapp')
    OR public.can_access_kanban_task((SELECT auth.uid()), organization_id, task_id)
  );

DROP POLICY IF EXISTS "WhatsApp users can read active ticket contexts" ON public.whatsapp_active_ticket_contexts;
CREATE POLICY "WhatsApp users can read active ticket contexts"
  ON public.whatsapp_active_ticket_contexts FOR SELECT TO authenticated
  USING (public.has_effective_module_access((SELECT auth.uid()), organization_id, 'whatsapp'));

DROP POLICY IF EXISTS "WhatsApp users can manage active ticket contexts" ON public.whatsapp_active_ticket_contexts;
CREATE POLICY "WhatsApp users can manage active ticket contexts"
  ON public.whatsapp_active_ticket_contexts FOR ALL TO authenticated
  USING (public.has_effective_module_access((SELECT auth.uid()), organization_id, 'whatsapp'))
  WITH CHECK (public.has_effective_module_access((SELECT auth.uid()), organization_id, 'whatsapp'));

DROP POLICY IF EXISTS "WhatsApp users can read task suggestions" ON public.whatsapp_task_suggestions;
CREATE POLICY "WhatsApp users can read task suggestions"
  ON public.whatsapp_task_suggestions FOR SELECT TO authenticated
  USING (public.has_effective_module_access((SELECT auth.uid()), organization_id, 'whatsapp'));

DROP POLICY IF EXISTS "WhatsApp users can manage task suggestions" ON public.whatsapp_task_suggestions;
CREATE POLICY "WhatsApp users can manage task suggestions"
  ON public.whatsapp_task_suggestions FOR ALL TO authenticated
  USING (public.has_effective_module_access((SELECT auth.uid()), organization_id, 'whatsapp'))
  WITH CHECK (public.has_effective_module_access((SELECT auth.uid()), organization_id, 'whatsapp'));

DROP POLICY IF EXISTS "WhatsApp users can read ticket sla records" ON public.whatsapp_ticket_sla_records;
CREATE POLICY "WhatsApp users can read ticket sla records"
  ON public.whatsapp_ticket_sla_records FOR SELECT TO authenticated
  USING (public.has_effective_module_access((SELECT auth.uid()), organization_id, 'whatsapp'));

DROP POLICY IF EXISTS "WhatsApp users can read ticket events" ON public.whatsapp_ticket_events;
CREATE POLICY "WhatsApp users can read ticket events"
  ON public.whatsapp_ticket_events FOR SELECT TO authenticated
  USING (public.has_effective_module_access((SELECT auth.uid()), organization_id, 'whatsapp'));

DROP POLICY IF EXISTS "WhatsApp admins can manage ticket automation settings" ON public.whatsapp_ticket_automation_settings;
CREATE POLICY "WhatsApp admins can manage ticket automation settings"
  ON public.whatsapp_ticket_automation_settings FOR ALL TO authenticated
  USING (
    public.has_effective_module_access((SELECT auth.uid()), organization_id, 'whatsapp')
    AND public.has_role((SELECT auth.uid()), 'admin')
  )
  WITH CHECK (
    public.has_effective_module_access((SELECT auth.uid()), organization_id, 'whatsapp')
    AND public.has_role((SELECT auth.uid()), 'admin')
  );

DROP POLICY IF EXISTS "WhatsApp ticket users can read ticket media" ON storage.objects;
CREATE POLICY "WhatsApp ticket users can read ticket media"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'whatsapp-media'
    AND public.has_effective_module_access(
      (SELECT auth.uid()),
      split_part(name, '/', 1)::uuid,
      'whatsapp'
    )
  );
