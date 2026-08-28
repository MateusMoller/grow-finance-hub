create schema if not exists private;
create extension if not exists pgcrypto with schema extensions;

create table public.integra_contador_connections (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  environment text not null check (environment in ('development','validation','production')), contractor_tax_id text not null check (contractor_tax_id ~ '^\d{14}$'),
  status text not null default 'pending' check (status in ('disabled','pending','validating','active','requires_action','failed')),
  credential_secret_ref text, certificate_secret_ref text, certificate_expires_at timestamptz, enabled_capabilities text[] not null default '{}',
  last_health_check_at timestamptz, last_success_at timestamptz, last_error_code text, created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (organization_id, environment)
);

create table public.fiscal_procurations (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade, connection_id uuid not null references public.integra_contador_connections(id) on delete cascade,
  author_tax_id text not null check (author_tax_id ~ '^(\d{11}|\d{14})$'), taxpayer_tax_id text not null check (taxpayer_tax_id ~ '^(\d{11}|\d{14})$'),
  capability_key text not null, status text not null default 'unknown' check (status in ('unknown','valid','missing','expired','insufficient','pending_validation')),
  valid_from timestamptz, valid_until timestamptz, verified_at timestamptz, external_reference_hash text, metadata_min jsonb not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (organization_id, client_id, author_tax_id, taxpayer_tax_id, capability_key)
);

create table public.fiscal_sync_runs (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null, connection_id uuid not null references public.integra_contador_connections(id) on delete cascade,
  capability_key text not null, reason text not null check (reason in ('user_request','monitor_event','scheduled_reconciliation','initial_import','retry','admin_reprocess')),
  status text not null default 'queued' check (status in ('queued','processing','waiting_external','completed','failed','requires_action','cancelled')),
  requested_by uuid references auth.users(id) on delete set null, source text not null, correlation_id uuid not null, request_fingerprint text not null,
  attempt_count integer not null default 0 check (attempt_count >= 0), max_attempts integer not null default 5 check (max_attempts between 1 and 20),
  next_attempt_at timestamptz, external_protocol text, external_wait_until timestamptz, records_received integer not null default 0 check (records_received >= 0),
  records_changed integer not null default 0 check (records_changed >= 0), error_code text, error_category text, error_summary text check (length(error_summary) <= 500),
  started_at timestamptz, finished_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.fiscal_operations (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null, capability_key text not null, operation text not null, period_key text,
  idempotency_key text not null, request_hash text not null, status text not null check (status in ('reserved','processing','waiting_external','completed','failed','requires_action')),
  external_reference text, correlation_id uuid not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);

create table public.fiscal_request_cache (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade, capability_key text not null, period_key text, request_fingerprint text not null,
  cache_category text not null check (cache_category in ('static','semi_static','transactional','real_time')), normalized_result jsonb not null,
  result_hash text not null, source_updated_at timestamptz, fetched_at timestamptz not null, valid_until timestamptz not null,
  last_usage_id uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (organization_id, client_id, capability_key, request_fingerprint)
);

create table public.receita_event_states (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade, connection_id uuid not null references public.integra_contador_connections(id) on delete cascade,
  taxpayer_tax_id text not null check (taxpayer_tax_id ~ '^(\d{11}|\d{14})$'), event_type text not null, remote_updated_at timestamptz,
  last_checked_at timestamptz not null, last_processed_at timestamptz, status text not null check (status in ('unchanged','changed','queued','processed','failed','requires_action')),
  external_protocol text, metadata_min jsonb not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (organization_id, client_id, event_type)
);

create table public.serpro_api_usage (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null, sync_run_id uuid references public.fiscal_sync_runs(id) on delete set null,
  operation_id uuid references public.fiscal_operations(id) on delete set null, correlation_id uuid not null, request_tag text not null check (length(request_tag) between 1 and 32),
  capability_key text not null, action text not null, source text not null, http_status integer, duration_ms integer not null check (duration_ms >= 0),
  cache_hit boolean not null default false, success boolean not null, billable boolean not null default false, error_type text, billing_class text,
  estimated_cost numeric(14,6), started_at timestamptz not null, finished_at timestamptz not null, created_at timestamptz not null default now()
);

create table public.fiscal_documents (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade, obligation_instance_id uuid, document_type text not null, period_key text,
  source text not null default 'integra_contador', external_reference text, content_hash text, storage_bucket text, storage_path text,
  issued_at timestamptz, expires_at timestamptz, metadata_min jsonb not null default '{}', portal_published_at timestamptz,
  portal_published_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.fiscal_reviews (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade, sync_run_id uuid references public.fiscal_sync_runs(id) on delete set null,
  review_type text not null, reason_code text not null, issue_fingerprint text not null, status text not null default 'open' check (status in ('open','in_review','resolved','dismissed')),
  recommended_action text not null check (length(recommended_action) <= 1000), task_id uuid, resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz, resolution jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table private.integra_contador_token_cache (
  connection_id uuid primary key references public.integra_contador_connections(id) on delete cascade,
  access_token_ciphertext text, jwt_token_ciphertext text, expires_at timestamptz, refresh_owner uuid, refresh_locked_until timestamptz,
  version bigint not null default 0, refreshed_at timestamptz, updated_at timestamptz not null default now()
);

do $$ declare t text; begin
  foreach t in array array['integra_contador_connections','fiscal_procurations','fiscal_sync_runs','fiscal_operations','fiscal_request_cache','receita_event_states','serpro_api_usage','fiscal_documents','fiscal_reviews'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;
revoke all on private.integra_contador_token_cache from public, anon, authenticated;
alter table private.integra_contador_token_cache enable row level security;

create policy fiscal_procurations_tenant_read on public.fiscal_procurations for select to authenticated using (public.is_internal_user((select auth.uid()), organization_id));
create policy fiscal_sync_runs_tenant_read on public.fiscal_sync_runs for select to authenticated using (public.is_internal_user((select auth.uid()), organization_id));
create policy fiscal_request_cache_tenant_read on public.fiscal_request_cache for select to authenticated using (public.is_internal_user((select auth.uid()), organization_id));
create policy receita_event_states_tenant_read on public.receita_event_states for select to authenticated using (public.is_internal_user((select auth.uid()), organization_id));
create policy fiscal_reviews_tenant_read on public.fiscal_reviews for select to authenticated using (public.is_internal_user((select auth.uid()), organization_id));
grant select on public.fiscal_procurations, public.fiscal_sync_runs, public.fiscal_request_cache, public.receita_event_states, public.fiscal_reviews to authenticated;
