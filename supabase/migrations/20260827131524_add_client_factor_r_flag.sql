alter table public.clients
  add column if not exists is_factor_r boolean not null default false;

comment on column public.clients.is_factor_r is
  'Indica se a empresa está enquadrada no Fator R para fins operacionais.';
