create table if not exists public.obligation_template_message_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  template_id uuid not null references public.obligation_templates(id) on delete cascade,
  channel text not null check (channel in ('email', 'whatsapp')),
  storage_bucket text not null default 'obligation-files',
  storage_path text not null,
  file_name text not null,
  content_type text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp', 'image/gif')),
  file_size bigint not null check (file_size > 0 and file_size <= 5242880),
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, storage_bucket, storage_path)
);

create index if not exists obligation_template_message_assets_template_channel_idx
  on public.obligation_template_message_assets (organization_id, template_id, channel, sort_order, created_at);

alter table public.obligation_template_message_assets enable row level security;

comment on table public.obligation_template_message_assets is
  'Reusable image attachments sent with obligation completion messages. Access is mediated by the tenant-aware Edge Function.';
