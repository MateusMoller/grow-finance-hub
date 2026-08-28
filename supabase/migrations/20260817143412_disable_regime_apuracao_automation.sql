-- Preserve historical rows while blocking new regime configuration dossiers.
create or replace function public.block_disabled_simple_national_automation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.obligation_kind = 'regime_apuracao' then
    raise exception 'automation_kind_disabled' using errcode = '22023';
  end if;
  return new;
end $$;

revoke all on function public.block_disabled_simple_national_automation() from public, anon, authenticated;

drop trigger if exists block_disabled_simple_national_automation on public.simple_national_dossiers;
create trigger block_disabled_simple_national_automation
before insert on public.simple_national_dossiers
for each row execute function public.block_disabled_simple_national_automation();
