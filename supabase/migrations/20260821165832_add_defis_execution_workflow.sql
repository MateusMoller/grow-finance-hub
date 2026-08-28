-- Assisted DEFIS execution. It reuses the existing annual dossier and keeps
-- external effects behind the Integra Contador provider gate.

create or replace function public.validate_simple_national_payload(
  _kind text, _competence_key text, _input jsonb, _sources jsonb
) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  _blocking jsonb := '[]'::jsonb;
  _warnings jsonb := '[]'::jsonb;
  _revenue numeric;
  _year integer;
begin
  if _kind not in ('pgdasd','defis','regime_apuracao') then
    _blocking := _blocking || jsonb_build_array(jsonb_build_object('code','unsupported_obligation','message','Obrigação não suportada.'));
  end if;
  if _competence_key !~ '^\d{4}(\d{2})?$' then
    _blocking := _blocking || jsonb_build_array(jsonb_build_object('code','invalid_competence','message','Competência inválida.'));
  end if;
  if jsonb_typeof(coalesce(_sources, 'null'::jsonb)) <> 'array' or jsonb_array_length(_sources) = 0 then
    _blocking := _blocking || jsonb_build_array(jsonb_build_object('code','missing_sources','message','Informe ao menos uma fonte dos dados.'));
  end if;
  if _kind = 'pgdasd' then
    if length(regexp_replace(coalesce(_input->>'cnpj',''), '\D', '', 'g')) <> 14 then
      _blocking := _blocking || jsonb_build_array(jsonb_build_object('code','invalid_cnpj','message','CNPJ do contribuinte é obrigatório.'));
    end if;
    if coalesce(_input->>'revenue_regime','') not in ('caixa','competencia') then
      _blocking := _blocking || jsonb_build_array(jsonb_build_object('code','missing_revenue_regime','message','Defina o regime de caixa ou competência.'));
    end if;
    begin _revenue := (_input->>'revenue_total')::numeric; exception when others then _revenue := null; end;
    if _revenue is null or _revenue < 0 then
      _blocking := _blocking || jsonb_build_array(jsonb_build_object('code','invalid_revenue','message','Informe a receita total da competência.'));
    end if;
    if jsonb_typeof(coalesce(_input->'revenue_by_activity','null'::jsonb)) <> 'array' or jsonb_array_length(_input->'revenue_by_activity') = 0 then
      _blocking := _blocking || jsonb_build_array(jsonb_build_object('code','missing_activity_breakdown','message','Classifique a receita por atividade.'));
    end if;
    if not (_input ? 'payroll_r12') then
      _warnings := _warnings || jsonb_build_array(jsonb_build_object('code','payroll_not_informed','message','Folha R12 não informada; confirme se o Fator R não se aplica.'));
    end if;
  elsif _kind = 'defis' then
    begin _year := _competence_key::integer; exception when others then _year := null; end;
    if length(_competence_key) <> 4 or _year is null then
      _blocking := _blocking || jsonb_build_array(jsonb_build_object('code','defis_requires_year','message','A DEFIS exige ano-calendário.'));
    end if;
    if length(regexp_replace(coalesce(_input->>'cnpj',''), '\D', '', 'g')) <> 14 then
      _blocking := _blocking || jsonb_build_array(jsonb_build_object('code','invalid_cnpj','message','CNPJ do contribuinte é obrigatório.'));
    end if;
    if coalesce((_input->>'partners_reviewed')::boolean,false) is not true
      or jsonb_typeof(coalesce(_input->'partners','null'::jsonb)) <> 'array'
      or jsonb_array_length(_input->'partners') = 0 then
      _blocking := _blocking || jsonb_build_array(jsonb_build_object('code','defis_partners_incomplete','message','Revise e informe ao menos um sócio com CPF, rendimentos e participação.'));
    end if;
    if jsonb_typeof(coalesce(_input->'establishments','null'::jsonb)) <> 'array'
      or jsonb_array_length(_input->'establishments') = 0 then
      _blocking := _blocking || jsonb_build_array(jsonb_build_object('code','defis_establishments_incomplete','message','Informe os dados anuais de ao menos um estabelecimento.'));
    end if;
    if not (_input ?& array['capital_gain','employees_at_start','employees_at_end','direct_export_revenue','variable_income_gain']) then
      _blocking := _blocking || jsonb_build_array(jsonb_build_object('code','defis_company_incomplete','message','Preencha ganhos, empregados e exportação da empresa.'));
    end if;
    if _year < 2025 and coalesce(_input->>'inactivity','') not in ('0','1','2') then
      _blocking := _blocking || jsonb_build_array(jsonb_build_object('code','defis_inactivity_required','message','Para ano-calendário anterior a 2025, informe a situação de inatividade.'));
    end if;
    if coalesce((_input->>'optional_information_reviewed')::boolean,false) is not true then
      _warnings := _warnings || jsonb_build_array(jsonb_build_object('code','defis_optional_information_review','message','Confirme a revisão das hipóteses de informação opcional por estabelecimento.'));
    end if;
  elsif _kind = 'regime_apuracao' then
    if length(_competence_key) <> 4 or coalesce(_input->>'revenue_regime','') not in ('caixa','competencia') then
      _blocking := _blocking || jsonb_build_array(jsonb_build_object('code','regime_incomplete','message','Informe ano e regime de apuração.'));
    end if;
  end if;
  return jsonb_build_object('blocking',_blocking,'warnings',_warnings,'valid',jsonb_array_length(_blocking)=0);
end $$;

create or replace function public.record_defis_declarations_sync(
  _organization_id uuid, _dossier_id uuid, _declarations jsonb
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare _d public.simple_national_dossiers%rowtype;
begin
  if auth.uid() is null or not public.is_internal_user(auth.uid(),_organization_id) then raise exception 'forbidden' using errcode='42501'; end if;
  select * into _d from public.simple_national_dossiers where id=_dossier_id and organization_id=_organization_id for update;
  if not found or _d.obligation_kind <> 'defis' then raise exception 'dossier_not_available'; end if;
  update public.simple_national_dossiers set preview_result=jsonb_build_object('declarations',coalesce(_declarations,'[]'::jsonb),'lastSyncedAt',now(),'provider','trial'),updated_by=auth.uid(),updated_at=now() where id=_dossier_id;
  insert into public.simple_national_dossier_events(organization_id,dossier_id,event_type,from_status,to_status,data_version,metadata,created_by)
  values(_organization_id,_dossier_id,'defis_declarations_synced',_d.status,_d.status,_d.data_version,jsonb_build_object('count',jsonb_array_length(coalesce(_declarations,'[]'::jsonb)),'provider','trial'),auth.uid());
  perform public.record_operational_audit_log(_organization_id,'simples_nacional.defis_declarations_synced','simple_national_dossier',_dossier_id,_d.client_id,'success',jsonb_build_object('count',jsonb_array_length(coalesce(_declarations,'[]'::jsonb)),'provider','trial'),null);
  return jsonb_build_object('id',_dossier_id,'declarations',coalesce(_declarations,'[]'::jsonb));
end $$;

create or replace function public.record_defis_transmission(
  _organization_id uuid, _dossier_id uuid, _expected_version integer,
  _external_declaration_id text, _declaration_storage_path text, _receipt_storage_path text
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare _d public.simple_national_dossiers%rowtype;
begin
  if auth.uid() is null or not public.is_internal_user(auth.uid(),_organization_id) then raise exception 'forbidden' using errcode='42501'; end if;
  select * into _d from public.simple_national_dossiers where id=_dossier_id and organization_id=_organization_id for update;
  if not found or _d.obligation_kind <> 'defis' then raise exception 'dossier_not_available'; end if;
  if _d.status <> 'approved' or _d.data_version <> _expected_version or _d.approved_data_version <> _expected_version then raise exception 'dossier_not_approved'; end if;
  update public.simple_national_dossiers set status='documents_issued',external_declaration_id=nullif(_external_declaration_id,''),external_transmitted_at=now(),declaration_storage_path=_declaration_storage_path,receipt_storage_path=_receipt_storage_path,provider_environment='trial',updated_by=auth.uid(),updated_at=now() where id=_dossier_id;
  insert into public.simple_national_dossier_events(organization_id,dossier_id,event_type,from_status,to_status,data_version,metadata,created_by)
  values(_organization_id,_dossier_id,'defis_transmitted',_d.status,'documents_issued',_d.data_version,jsonb_build_object('provider','trial','idDefis',_external_declaration_id),auth.uid());
  perform public.record_operational_audit_log(_organization_id,'simples_nacional.defis_transmitted','simple_national_dossier',_dossier_id,_d.client_id,'success',jsonb_build_object('provider','trial','idDefis',_external_declaration_id),null);
  return jsonb_build_object('id',_dossier_id,'status','documents_issued','externalDeclarationId',_external_declaration_id);
end $$;

revoke all on function public.record_defis_declarations_sync(uuid,uuid,jsonb),public.record_defis_transmission(uuid,uuid,integer,text,text,text) from public,anon;
grant execute on function public.record_defis_declarations_sync(uuid,uuid,jsonb),public.record_defis_transmission(uuid,uuid,integer,text,text,text) to authenticated;
