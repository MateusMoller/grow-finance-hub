alter table public.whatsapp_conversations
  add column if not exists provider_phone_number_id text,
  add column if not exists provider_display_phone_number text;

alter table public.whatsapp_messages
  add column if not exists provider_phone_number_id text,
  add column if not exists provider_display_phone_number text;

create index if not exists whatsapp_conversations_provider_phone_idx
  on public.whatsapp_conversations (organization_id, provider_phone_number_id)
  where provider_phone_number_id is not null;
