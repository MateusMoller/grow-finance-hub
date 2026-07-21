-- Manual RLS checks for WhatsApp Client Chat.
-- Run with authenticated test users from different organizations.

-- 1. A user without the whatsapp module must not read conversations.
select count(*) as denied_without_module
from public.whatsapp_conversations
where not public.has_effective_module_access((select auth.uid()), organization_id, 'whatsapp');

-- 2. Conversation data must stay scoped to the current organization.
select count(*) as cross_tenant_rows
from public.whatsapp_messages
where organization_id <> public.current_organization_id();

-- 3. Attachment storage paths must start with organization id.
select id, storage_path
from public.whatsapp_conversation_attachments
where storage_path is not null
  and split_part(storage_path, '/', 1) <> organization_id::text;

-- 4. Notification rows must target the current authenticated user or queue scope only.
select count(*) as foreign_user_notifications
from public.whatsapp_conversation_notifications
where target_user_id is not null
  and target_user_id <> (select auth.uid());
