CREATE TABLE IF NOT EXISTS public.whatsapp_task_creation_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.whatsapp_contacts(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'collecting_sector'
    CHECK (status IN ('collecting_sector', 'collecting_title', 'collecting_description', 'completed', 'cancelled', 'expired')),
  sector text,
  title text,
  description text,
  source_message_id uuid REFERENCES public.whatsapp_messages(id) ON DELETE SET NULL,
  created_task_id uuid REFERENCES public.kanban_tasks(id) ON DELETE SET NULL,
  created_ticket_id uuid REFERENCES public.whatsapp_customer_tickets(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '2 hours'),
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_task_creation_flows ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS ux_whatsapp_task_creation_flows_active
  ON public.whatsapp_task_creation_flows (organization_id, conversation_id)
  WHERE status IN ('collecting_sector', 'collecting_title', 'collecting_description');

CREATE INDEX IF NOT EXISTS idx_whatsapp_task_creation_flows_expiry
  ON public.whatsapp_task_creation_flows (organization_id, expires_at)
  WHERE status IN ('collecting_sector', 'collecting_title', 'collecting_description');

DROP POLICY IF EXISTS "WhatsApp users can read task creation flows" ON public.whatsapp_task_creation_flows;
CREATE POLICY "WhatsApp users can read task creation flows"
  ON public.whatsapp_task_creation_flows FOR SELECT TO authenticated
  USING (
    public.has_effective_module_access(auth.uid(), organization_id, 'whatsapp')
  );

DROP POLICY IF EXISTS "WhatsApp users can manage task creation flows" ON public.whatsapp_task_creation_flows;
CREATE POLICY "WhatsApp users can manage task creation flows"
  ON public.whatsapp_task_creation_flows FOR ALL TO authenticated
  USING (
    public.has_effective_module_access(auth.uid(), organization_id, 'whatsapp')
  )
  WITH CHECK (
    public.has_effective_module_access(auth.uid(), organization_id, 'whatsapp')
  );
