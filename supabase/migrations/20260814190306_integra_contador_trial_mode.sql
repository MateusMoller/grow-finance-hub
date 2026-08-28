create or replace function public.activate_integra_contador_trial(_organization_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare _id uuid;
begin
  if not public.is_permission_admin(_organization_id) then raise exception 'forbidden' using errcode='42501'; end if;
  insert into public.integra_contador_connections(organization_id,environment,contractor_tax_id,status,enabled_capabilities,last_health_check_at,last_success_at,configured_at,created_by,updated_by)
  values(_organization_id,'development','00000000000000','active',array['caixa_postal.new_message_indicator'],now(),now(),now(),auth.uid(),auth.uid())
  on conflict(organization_id,environment) do update set status='active',enabled_capabilities=array['caixa_postal.new_message_indicator'],last_health_check_at=now(),last_success_at=now(),last_error_code=null,updated_by=auth.uid(),updated_at=now()
  returning id into _id;
  perform public.record_operational_audit_log(_organization_id,'integra_contador.trial_activated','integra_contador_connection',_id,null,'success',jsonb_build_object('provider','trial','externalEffects',false),null);
  return _id;
end $$;
revoke all on function public.activate_integra_contador_trial(uuid) from public,anon;
grant execute on function public.activate_integra_contador_trial(uuid) to authenticated;
