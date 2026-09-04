-- Normalized, tenant-scoped projection of SERPRO Integra-Parcelamentos.
create table public.fiscal_installment_agreements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  modality text not null check (modality in ('PARCSN','PARCSN-ESP','PERTSN','RELPSN','PARCMEI','PARCMEI-ESP','PERTMEI','RELPMEI')),
  agreement_number text not null,
  requested_at date,
  status text not null,
  status_date date,
  total_consolidated numeric(15,2),
  installment_count integer,
  basic_installment_amount numeric(15,2),
  remaining_installments integer,
  debt_details jsonb not null default '[]'::jsonb,
  debt_changes jsonb not null default '[]'::jsonb,
  last_synced_at timestamptz not null default now(),
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, client_id, modality, agreement_number)
);

create table public.fiscal_installment_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  agreement_id uuid not null references public.fiscal_installment_agreements(id) on delete cascade,
  period_key text not null check (period_key ~ '^20[0-9]{4}$'),
  installment_number text,
  amount numeric(15,2),
  due_date date,
  status text not null default 'available' check (status in ('available','issued','paid','overdue','cancelled','unknown')),
  available_for_issue boolean not null default false,
  issued_at timestamptz,
  paid_at date,
  task_id uuid references public.kanban_tasks(id) on delete set null,
  fiscal_document_id uuid references public.fiscal_documents(id) on delete set null,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agreement_id, period_key)
);

create table public.fiscal_installment_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  agreement_id uuid not null references public.fiscal_installment_agreements(id) on delete cascade,
  entry_id uuid references public.fiscal_installment_entries(id) on delete set null,
  period_key text not null check (period_key ~ '^20[0-9]{4}$'),
  das_number text,
  installment_number text,
  due_date date,
  acceptance_deadline date,
  paid_at date not null,
  bank_agency text,
  amount_paid numeric(15,2) not null,
  tax_breakdown jsonb not null default '[]'::jsonb,
  evidence_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agreement_id, period_key, evidence_hash)
);

create index fiscal_installment_agreements_client_idx on public.fiscal_installment_agreements (organization_id, client_id, status, last_synced_at desc);
create index fiscal_installment_entries_action_idx on public.fiscal_installment_entries (organization_id, status, due_date) where status in ('available','issued','overdue');
create index fiscal_installment_payments_client_idx on public.fiscal_installment_payments (organization_id, client_id, paid_at desc);

alter table public.fiscal_installment_agreements enable row level security;
alter table public.fiscal_installment_entries enable row level security;
alter table public.fiscal_installment_payments enable row level security;

create policy fiscal_installment_agreements_read on public.fiscal_installment_agreements for select to authenticated
using (public.is_internal_user((select auth.uid()), organization_id));
create policy fiscal_installment_entries_read on public.fiscal_installment_entries for select to authenticated
using (public.is_internal_user((select auth.uid()), organization_id));
create policy fiscal_installment_payments_read on public.fiscal_installment_payments for select to authenticated
using (public.is_internal_user((select auth.uid()), organization_id));

grant select on public.fiscal_installment_agreements, public.fiscal_installment_entries, public.fiscal_installment_payments to authenticated;

update public.organization_settings
set feature_flags = jsonb_set(coalesce(feature_flags, '{}'::jsonb), '{integra_parcelamentos}', 'false'::jsonb, true),
    updated_at = now()
where not (coalesce(feature_flags, '{}'::jsonb) ? 'integra_parcelamentos');

alter table public.user_module_grants drop constraint if exists user_module_grants_module_check;
alter table public.user_module_grants add constraint user_module_grants_module_check check (module_key in (
  'dashboard','portal','clientes','cadastrar_clientes','financeiro','obrigacoes','ia','whatsapp','open_finance',
  'acessorias','robo_documentos','crm','chat_interno','calendario','tarefas','formularios','relatorios',
  'notificacoes','usuarios','solicitacoes','newsletter','sugestoes','manual','configuracoes','notas_fiscais','parcelamentos'
));

comment on table public.fiscal_installment_agreements is 'Parcelamentos existentes sincronizados do SERPRO; não cria novos acordos.';
comment on table public.fiscal_installment_entries is 'Parcelas disponíveis, emitidas ou pagas vinculadas ao acordo.';
comment on table public.fiscal_installment_payments is 'Evidência imutável normalizada de pagamento retornada pelo SERPRO.';

create or replace function private.invoke_integra_contador_installments(_mode text)
returns bigint language plpgsql security definer set search_path='' as $$
declare _url text; _secret text; _service_key text;
begin
  if _mode not in ('active','discovery') then raise exception 'invalid mode'; end if;
  select decrypted_secret into _url from vault.decrypted_secrets where name='integra_contador_internal_base_url' limit 1;
  select decrypted_secret into _secret from vault.decrypted_secrets where name='integra_contador_internal_worker_secret' limit 1;
  select decrypted_secret into _service_key from vault.decrypted_secrets where name='integra_contador_internal_service_role_key' limit 1;
  if _url is null or _secret is null or _service_key is null then return null; end if;
  return net.http_post(url:=_url||'/functions/v1/integra-contador-installments',body:=jsonb_build_object('action','scheduled_sync','mode',_mode),headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||_service_key,'x-worker-token',_secret),timeout_milliseconds:=5000);
end $$;
revoke all on function private.invoke_integra_contador_installments(text) from public,anon,authenticated;

do $$ begin
  perform cron.unschedule(jobid) from cron.job where jobname in ('integra-parcelamentos-active','integra-parcelamentos-discovery');
  perform cron.schedule('integra-parcelamentos-active','17 5 * * *',$job$select private.invoke_integra_contador_installments('active')$job$);
  perform cron.schedule('integra-parcelamentos-discovery','47 4 * * 0',$job$select private.invoke_integra_contador_installments('discovery')$job$);
end $$;
