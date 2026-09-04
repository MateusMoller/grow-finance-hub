create table public.client_cnd_certificates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  status text not null check (status in ('valid','not_issued','processing','failed')),
  provider_status integer,
  provider_message text,
  certificate_type integer,
  control_code text,
  taxpayer_number text,
  issued_at timestamptz,
  valid_until date,
  storage_bucket text,
  storage_path text,
  content_sha256 text,
  provider_payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index client_cnd_control_code_key
  on public.client_cnd_certificates(organization_id,client_id,control_code)
  where control_code is not null;
create index client_cnd_latest_idx
  on public.client_cnd_certificates(organization_id,client_id,created_at desc);

alter table public.client_cnd_certificates enable row level security;
create policy "Tenant internal can view CND certificates"
  on public.client_cnd_certificates for select to authenticated
  using (public.is_internal_user((select auth.uid()),organization_id));

grant select on public.client_cnd_certificates to authenticated;

comment on table public.client_cnd_certificates is
  'Internal history of federal CND consultations. PDF access is issued only through an authenticated Edge Function.';
