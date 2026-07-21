CREATE TABLE IF NOT EXISTS public.whatsapp_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  display_name text,
  profile_name text,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  auto_link_source text CHECK (auto_link_source IN ('unique_phone_match', 'manual') OR auto_link_source IS NULL),
  match_status text NOT NULL DEFAULT 'unmatched' CHECK (match_status IN ('matched', 'unmatched', 'manual', 'conflict')),
  last_seen_at timestamptz,
  is_blocked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, phone_number)
);

CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.whatsapp_contacts(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_attendance', 'pending_client', 'resolved', 'archived')),
  assigned_to_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_team text,
  last_message_id uuid,
  last_message_at timestamptz,
  last_message_preview text,
  unread_count integer NOT NULL DEFAULT 0 CHECK (unread_count >= 0),
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  active_window_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.whatsapp_contacts(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  sender_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  provider_message_id text,
  client_message_id text,
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'document', 'unknown')),
  body text,
  safe_preview text,
  delivery_status text NOT NULL DEFAULT 'received' CHECK (delivery_status IN ('queued', 'sending', 'sent', 'delivered', 'read', 'failed', 'received')),
  failure_reason text,
  blocked_reason text,
  sent_at timestamptz,
  received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_messages_provider_unique_constraint'
  ) THEN
    ALTER TABLE public.whatsapp_messages
      ADD CONSTRAINT whatsapp_messages_provider_unique_constraint UNIQUE (organization_id, provider_message_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_messages_client_unique_constraint'
  ) THEN
    ALTER TABLE public.whatsapp_messages
      ADD CONSTRAINT whatsapp_messages_client_unique_constraint UNIQUE (organization_id, client_message_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.whatsapp_conversation_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES public.whatsapp_messages(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  provider_media_id text,
  storage_path text,
  file_name text,
  content_type text,
  size_bytes bigint,
  allowed_type text CHECK (allowed_type IN ('image', 'pdf', 'document') OR allowed_type IS NULL),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'stored', 'sent', 'failed', 'blocked')),
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_conversation_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  assigned_to_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_team text,
  assigned_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_conversation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.whatsapp_messages(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'inbound_received',
    'outbound_requested',
    'outbound_sent',
    'delivery_updated',
    'send_failed',
    'assignment_changed',
    'status_changed',
    'client_link_changed',
    'attachment_stored',
    'attachment_sent',
    'attachment_blocked'
  )),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  provider_event_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_conversation_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  target_scope text NOT NULL DEFAULT 'user' CHECK (target_scope IN ('user', 'queue')),
  notification_type text NOT NULL CHECK (notification_type IN ('new_message', 'assigned', 'send_failed')),
  title text NOT NULL,
  body text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_messages_provider_unique
  ON public.whatsapp_messages (organization_id, provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_messages_client_unique
  ON public.whatsapp_messages (organization_id, client_message_id)
  WHERE client_message_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_active_conversation_unique
  ON public.whatsapp_conversations (organization_id, contact_id)
  WHERE status <> 'archived';

CREATE INDEX IF NOT EXISTS whatsapp_conversations_queue_idx
  ON public.whatsapp_conversations (organization_id, status, assigned_to_user_id, last_message_at DESC);

CREATE INDEX IF NOT EXISTS whatsapp_conversations_unread_idx
  ON public.whatsapp_conversations (organization_id, unread_count)
  WHERE unread_count > 0;

CREATE INDEX IF NOT EXISTS whatsapp_contacts_phone_idx
  ON public.whatsapp_contacts (organization_id, phone_number);

CREATE INDEX IF NOT EXISTS whatsapp_messages_timeline_idx
  ON public.whatsapp_messages (conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS whatsapp_attachments_message_idx
  ON public.whatsapp_conversation_attachments (message_id);

ALTER TABLE public.whatsapp_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_conversation_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_conversation_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_conversation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_conversation_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "WhatsApp users can read contacts"
  ON public.whatsapp_contacts FOR SELECT TO authenticated
  USING (public.has_effective_module_access((SELECT auth.uid()), organization_id, 'whatsapp'));

CREATE POLICY "WhatsApp users can read conversations"
  ON public.whatsapp_conversations FOR SELECT TO authenticated
  USING (public.has_effective_module_access((SELECT auth.uid()), organization_id, 'whatsapp'));

CREATE POLICY "WhatsApp users can update conversation read state"
  ON public.whatsapp_conversations FOR UPDATE TO authenticated
  USING (public.has_effective_module_access((SELECT auth.uid()), organization_id, 'whatsapp'))
  WITH CHECK (public.has_effective_module_access((SELECT auth.uid()), organization_id, 'whatsapp'));

CREATE POLICY "WhatsApp users can read messages"
  ON public.whatsapp_messages FOR SELECT TO authenticated
  USING (public.has_effective_module_access((SELECT auth.uid()), organization_id, 'whatsapp'));

CREATE POLICY "WhatsApp users can read attachments"
  ON public.whatsapp_conversation_attachments FOR SELECT TO authenticated
  USING (public.has_effective_module_access((SELECT auth.uid()), organization_id, 'whatsapp'));

CREATE POLICY "WhatsApp users can read assignments"
  ON public.whatsapp_conversation_assignments FOR SELECT TO authenticated
  USING (public.has_effective_module_access((SELECT auth.uid()), organization_id, 'whatsapp'));

CREATE POLICY "WhatsApp users can read events"
  ON public.whatsapp_conversation_events FOR SELECT TO authenticated
  USING (public.has_effective_module_access((SELECT auth.uid()), organization_id, 'whatsapp'));

CREATE POLICY "WhatsApp users can read own notifications"
  ON public.whatsapp_conversation_notifications FOR SELECT TO authenticated
  USING (
    public.has_effective_module_access((SELECT auth.uid()), organization_id, 'whatsapp')
    AND (target_user_id IS NULL OR target_user_id = (SELECT auth.uid()))
  );

CREATE POLICY "WhatsApp users can update own notifications"
  ON public.whatsapp_conversation_notifications FOR UPDATE TO authenticated
  USING (
    public.has_effective_module_access((SELECT auth.uid()), organization_id, 'whatsapp')
    AND (target_user_id IS NULL OR target_user_id = (SELECT auth.uid()))
  )
  WITH CHECK (
    public.has_effective_module_access((SELECT auth.uid()), organization_id, 'whatsapp')
    AND (target_user_id IS NULL OR target_user_id = (SELECT auth.uid()))
  );

INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-media', 'whatsapp-media', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "WhatsApp users can read media"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'whatsapp-media'
    AND public.has_effective_module_access(
      (SELECT auth.uid()),
      split_part(name, '/', 1)::uuid,
      'whatsapp'
    )
  );

CREATE POLICY "WhatsApp users can upload media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'whatsapp-media'
    AND public.has_effective_module_access(
      (SELECT auth.uid()),
      split_part(name, '/', 1)::uuid,
      'whatsapp'
    )
  );

-- Rollback notes:
-- 1. Disable the `/app/whatsapp` route and remove the provider webhook before dropping objects.
-- 2. Export `whatsapp_conversation_events` and `whatsapp_messages` if audit retention is required.
-- 3. Drop storage policies/bucket after confirming no retained media must be preserved.
