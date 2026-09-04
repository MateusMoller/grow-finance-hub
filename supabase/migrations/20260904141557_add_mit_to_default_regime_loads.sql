insert into public.obligation_regime_load_items(
  organization_id,load_id,template_id,applicability,condition_key,
  default_start_policy,sort_order,notes,is_active
)
select
  loads.organization_id,loads.id,templates.id,'required',null,
  'client_created_at',15,
  'MIT interna obrigatória para o regime; conclusão somente após confirmação SERPRO.',true
from public.obligation_regime_loads loads
join public.obligation_templates templates
  on templates.organization_id=loads.organization_id and templates.code='mit'
where loads.status='active' and loads.tax_regime_code in ('lucro_presumido','lucro_real')
on conflict (organization_id,load_id,template_id) where is_active=true do update
set applicability='required',condition_key=null,default_start_policy='client_created_at',
    sort_order=15,notes=excluded.notes,is_active=true,updated_at=now();
