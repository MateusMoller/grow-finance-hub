create table public.fiscal_invoice_sync_states (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  source text not null check (source in ('nfe_sefaz', 'nfse_adn')),
  environment text not null default 'production' check (environment in ('homologation', 'production')),
  last_nsu bigint not null default 0 check (last_nsu >= 0),
  max_nsu bigint check (max_nsu is null or max_nsu >= 0),
  status text not null default 'idle' check (status in ('idle', 'queued', 'syncing', 'up_to_date', 'requires_action', 'failed')),
  next_allowed_at timestamptz,
  last_synced_at timestamptz,
  last_success_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, client_id, source, environment)
);

create table public.fiscal_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  source text not null check (source in ('nfe_sefaz', 'nfse_adn')),
  nsu bigint check (nsu is null or nsu >= 0),
  access_key text not null check (length(access_key) between 20 and 64),
  document_model text not null,
  document_number text,
  series text,
  direction text not null default 'unknown' check (direction in ('issued', 'received', 'unknown')),
  status text not null default 'authorized' check (status in ('authorized', 'cancelled', 'denied', 'summary', 'unknown')),
  issued_at timestamptz,
  competence_date date,
  issuer_tax_id text,
  issuer_name text,
  recipient_tax_id text,
  recipient_name text,
  total_amount numeric(18,2),
  service_amount numeric(18,2),
  tax_amount numeric(18,2),
  xml_bucket text not null default 'fiscal-invoice-xml',
  xml_path text,
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  schema_name text,
  metadata_min jsonb not null default '{}',
  first_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, source, access_key)
);

create table public.fiscal_invoice_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  invoice_id uuid references public.fiscal_invoices(id) on delete cascade,
  source text not null check (source in ('nfe_sefaz', 'nfse_adn')),
  event_key text not null,
  event_type text not null,
  sequence integer,
  occurred_at timestamptz,
  xml_bucket text not null default 'fiscal-invoice-xml',
  xml_path text,
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  unique (organization_id, source, event_key)
);

create table public.fiscal_invoice_sync_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  source text not null check (source in ('nfe_sefaz', 'nfse_adn')),
  reason text not null check (reason in ('manual', 'scheduled', 'retry', 'initial_import')),
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed', 'requires_action')),
  initial_nsu bigint not null default 0,
  final_nsu bigint,
  documents_received integer not null default 0,
  documents_changed integer not null default 0,
  requested_by uuid references auth.users(id) on delete set null,
  correlation_id uuid not null default gen_random_uuid(),
  error_code text,
  error_summary text check (length(error_summary) <= 500),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

do $$ declare table_name text; begin
  foreach table_name in array array['fiscal_invoice_sync_states','fiscal_invoices','fiscal_invoice_events','fiscal_invoice_sync_runs'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from public, anon, authenticated', table_name);
  end loop;
end $$;

create index fiscal_invoices_client_date_idx on public.fiscal_invoices (organization_id, client_id, issued_at desc);
create index fiscal_invoices_counterparty_idx on public.fiscal_invoices (organization_id, issuer_tax_id, recipient_tax_id);
create index fiscal_invoice_sync_runs_lookup_idx on public.fiscal_invoice_sync_runs (organization_id, client_id, created_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fiscal-invoice-xml', 'fiscal-invoice-xml', false, 5242880, array['application/xml', 'text/xml', 'application/octet-stream'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Intentionally no storage.objects policies: XML is only handled by the trusted
-- invoice Edge Functions. The UI receives normalized, tenant-scoped metadata.

alter table public.user_module_grants drop constraint if exists user_module_grants_module_check;
alter table public.user_module_grants add constraint user_module_grants_module_check check (module_key in (
  'dashboard','portal','clientes','cadastrar_clientes','financeiro','obrigacoes','ia','whatsapp','open_finance',
  'acessorias','robo_documentos','crm','chat_interno','calendario','tarefas','formularios','relatorios',
  'notificacoes','usuarios','solicitacoes','newsletter','sugestoes','manual','configuracoes','notas_fiscais'
));
