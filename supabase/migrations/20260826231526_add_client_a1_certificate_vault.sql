-- A1 certificates are deliberately not exposed through the Data API.
-- Ciphertext can only be written/read by the certificate-vault Edge Function
-- through the service role. The encryption key lives exclusively in Function Secrets.
create table public.client_a1_certificates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  storage_bucket text not null default 'client-certificate-vault',
  storage_path text not null,
  password_ciphertext text not null,
  password_iv text not null,
  file_iv text not null,
  encryption_key_version smallint not null default 1,
  certificate_fingerprint_sha256 text not null check (certificate_fingerprint_sha256 ~ '^[a-f0-9]{64}$'),
  certificate_serial_number text,
  valid_from timestamptz,
  expires_at timestamptz,
  status text not null default 'active' check (status in ('active', 'expired', 'revoked', 'replaced')),
  created_by uuid not null references auth.users(id) on delete restrict,
  replaced_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, client_id)
);

create table public.client_a1_certificate_audit (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  certificate_id uuid references public.client_a1_certificates(id) on delete set null,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in ('uploaded', 'replaced', 'removed', 'status_viewed')),
  request_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table public.client_a1_certificates enable row level security;
alter table public.client_a1_certificate_audit enable row level security;
revoke all on public.client_a1_certificates from public, anon, authenticated;
revoke all on public.client_a1_certificate_audit from public, anon, authenticated;

create index client_a1_certificate_audit_lookup_idx
  on public.client_a1_certificate_audit (organization_id, client_id, created_at desc);
create index client_a1_certificates_expiry_idx
  on public.client_a1_certificates (expires_at)
  where status = 'active';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'client-certificate-vault',
  'client-certificate-vault',
  false,
  1048576,
  array['application/octet-stream']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- No storage.objects policy is intentional. Browser clients cannot list, upload,
-- download, update or delete certificate ciphertext. Only service-role code can.
