create table public.client_monthly_values (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  reference_month date not null check (reference_month = date_trunc('month', reference_month)::date),
  payroll_with_charges numeric(18,2) check (payroll_with_charges is null or payroll_with_charges >= 0),
  gross_revenue numeric(18,2) check (gross_revenue is null or gross_revenue >= 0),
  notes text check (notes is null or length(notes) <= 500),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, client_id, reference_month)
);

create index client_monthly_values_lookup_idx
  on public.client_monthly_values (organization_id, client_id, reference_month desc);

alter table public.client_monthly_values enable row level security;
revoke all on public.client_monthly_values from public, anon;
grant select, insert, update, delete on public.client_monthly_values to authenticated;

create policy "Tenant can view client monthly values"
on public.client_monthly_values for select to authenticated
using (
  is_internal_user((select auth.uid()), organization_id)
  or can_access_client((select auth.uid()), client_id)
);

create policy "Tenant internal can insert client monthly values"
on public.client_monthly_values for insert to authenticated
with check (
  is_internal_user((select auth.uid()), organization_id)
  and exists (
    select 1 from public.clients c
    where c.id = client_id and c.organization_id = organization_id
  )
);

create policy "Tenant internal can update client monthly values"
on public.client_monthly_values for update to authenticated
using (is_internal_user((select auth.uid()), organization_id))
with check (
  is_internal_user((select auth.uid()), organization_id)
  and exists (
    select 1 from public.clients c
    where c.id = client_id and c.organization_id = organization_id
  )
);

create policy "Tenant internal can delete client monthly values"
on public.client_monthly_values for delete to authenticated
using (is_internal_user((select auth.uid()), organization_id));

create or replace function public.calculate_client_factor_r(
  _client_id uuid,
  _pgdas_competence date
)
returns table (
  applies boolean,
  period_start date,
  period_end date,
  months_complete integer,
  payroll_fs12 numeric,
  gross_revenue_rbt12 numeric,
  factor_r numeric,
  threshold numeric,
  result_status text
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with client_scope as (
    select c.id, c.organization_id, c.is_factor_r
    from public.clients c
    where c.id = _client_id
      and (
        public.is_internal_user((select auth.uid()), c.organization_id)
        or public.can_access_client((select auth.uid()), c.id)
      )
  ), bounds as (
    select
      (date_trunc('month', _pgdas_competence)::date - interval '12 months')::date as start_date,
      (date_trunc('month', _pgdas_competence)::date - interval '1 month')::date as end_date
  ), totals as (
    select
      count(*) filter (where v.payroll_with_charges is not null and v.gross_revenue is not null)::integer as complete_count,
      coalesce(sum(v.payroll_with_charges), 0)::numeric as payroll_total,
      coalesce(sum(v.gross_revenue), 0)::numeric as revenue_total
    from client_scope c
    cross join bounds b
    left join public.client_monthly_values v
      on v.organization_id = c.organization_id
     and v.client_id = c.id
     and v.reference_month between b.start_date and b.end_date
  ), calculated as (
    select
      c.is_factor_r,
      b.start_date,
      b.end_date,
      t.complete_count,
      t.payroll_total,
      t.revenue_total,
      case
        when t.complete_count < 12 then null
        when t.payroll_total = 0 then 0.01::numeric
        when t.revenue_total = 0 then 0.28::numeric
        else round(t.payroll_total / t.revenue_total, 6)
      end as ratio
    from client_scope c
    cross join bounds b
    cross join totals t
  )
  select
    is_factor_r,
    start_date,
    end_date,
    complete_count,
    payroll_total,
    revenue_total,
    ratio,
    0.28::numeric,
    case
      when not is_factor_r then 'not_applicable'
      when complete_count < 12 then 'insufficient_data'
      when ratio < 0.28 then 'below_threshold'
      else 'meets_threshold'
    end
  from calculated;
$$;

revoke all on function public.calculate_client_factor_r(uuid, date) from public, anon;
grant execute on function public.calculate_client_factor_r(uuid, date) to authenticated;

comment on function public.calculate_client_factor_r(uuid, date) is
  'Calcula FS12/RBT12 usando os 12 meses anteriores à competência do PGDAS-D; retorna incompleto quando faltam meses.';
